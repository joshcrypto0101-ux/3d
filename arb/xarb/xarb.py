#!/usr/bin/env python3
"""
xarb.py — 跨交易所永续合约中性价差套利 (taker-only)

结构:  A 所 与 B 所 各持一腿, 方向相反, 币数相等 → 净敞口 0。
信号:  有效价差 (按 clip 数量算盘口 VWAP) 扣除 4 腿费用与滑点后仍有净利, 且基差 z-score 偏离。
执行:  两腿同时发 IOC 限价单 (带保护价), 单腿失败 → 重试 → 仍失败则把已成交腿平掉。
风控:  净 delta、杠杆、保证金率、日亏损、盘口过期、费率结算前守卫、kill switch。

用法:
  pip install ccxt pyyaml
  export OKX_KEY=... OKX_SECRET=... OKX_PASSPHRASE=... HTX_KEY=... HTX_SECRET=...
  python xarb.py config.yaml          # mode: paper 时只用公共行情, 模拟成交
"""
import asyncio, os, re, sys, time, json, math, statistics, logging, signal
from collections import deque
from dataclasses import dataclass, field
import yaml
import ccxt.pro as ccxtpro

# ---------- 配置 ----------
def load_config(path):
    raw = open(path, encoding="utf-8").read()
    raw = re.sub(r"\$\{(\w+)\}", lambda m: os.environ.get(m.group(1), ""), raw)
    return yaml.safe_load(raw)

# ---------- 盘口 ----------
@dataclass
class Book:
    bids: list = field(default_factory=list)   # [(price, qty)] 降序
    asks: list = field(default_factory=list)   # 升序
    ts: float = 0.0

    def mid(self):
        return (self.bids[0][0] + self.asks[0][0]) / 2 if self.bids and self.asks else None

    def vwap(self, side, qty):
        """按 qty 吃单的成交均价; 深度不够返回 None"""
        levels = self.bids if side == "sell" else self.asks
        need, cost = qty, 0.0
        for p, q in levels:
            take = min(q, need); cost += take * p; need -= take
            if need <= 1e-12: return cost / qty
        return None

# ---------- 状态 ----------
@dataclass
class State:
    pos_A: float = 0.0      # 币数, 多为正
    pos_B: float = 0.0
    entry_bp: float = 0.0   # 开仓时锁定的有效价差 (bp)
    realized: float = 0.0   # USDT
    fees: float = 0.0
    trips: int = 0
    halted: bool = False
    day: str = ""
    day_pnl: float = 0.0

class XArb:
    def __init__(self, cfg):
        self.cfg = cfg
        self.sym = cfg["symbol"]
        self.paper = cfg.get("mode", "paper") == "paper"
        self.books = {"A": Book(), "B": Book()}
        self.ex = {}
        for k in ("A", "B"):
            v = cfg["venues"][k]
            kw = {"enableRateLimit": True, "options": {"defaultType": "swap"}}
            if not self.paper:
                kw.update({"apiKey": v.get("apiKey"), "secret": v.get("secret")})
                if v.get("password"): kw["password"] = v["password"]
            self.ex[k] = getattr(ccxtpro, v["id"])(kw)
            # 走系统代理 (HTTPS_PROXY) 的环境: REST 与 websocket 都要配; 直连环境不受影响
            proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
            if proxy:
                self.ex[k].aiohttp_trust_env = True
                self.ex[k].wss_proxy = proxy
        self.fee_bp = {k: cfg["venues"][k]["taker_fee_bp"] for k in ("A", "B")}
        self.csize = {"A": 1.0, "B": 1.0}   # 合约面值 (币/张), load_markets 后填
        self.st = State()
        self.basis_hist = deque()   # (ts, basis_bp)
        self.log = logging.getLogger("xarb")
        os.makedirs(cfg.get("log_dir", "./logs"), exist_ok=True)
        self.state_file = os.path.join(cfg.get("log_dir", "./logs"), "state.json")
        self._load_state()

    # ---------- 持久化 ----------
    def _load_state(self):
        if os.path.exists(self.state_file):
            d = json.load(open(self.state_file))
            self.st = State(**d)
    def _save_state(self):
        json.dump(self.st.__dict__, open(self.state_file, "w"), indent=1)

    # ---------- 行情 ----------
    async def watch(self, k):
        ex = self.ex[k]
        await ex.load_markets()
        self.csize[k] = float(ex.market(self.sym).get("contractSize") or 1.0)
        self.log.info(f"[{k}] {ex.id} contractSize={self.csize[k]}")
        while not self.st.halted:
            try:
                ob = await ex.watch_order_book(self.sym, 20)
                b = self.books[k]; cs = self.csize[k]
                b.bids = [(float(l[0]), float(l[1]) * cs) for l in ob["bids"]]   # 张 → 币
                b.asks = [(float(l[0]), float(l[1]) * cs) for l in ob["asks"]]
                b.ts = time.time()
            except Exception as e:
                self.log.warning(f"[{k}] orderbook error: {e}"); await asyncio.sleep(1)

    def fresh(self):
        lim = self.cfg["signal"]["stale_ms"] / 1000
        now = time.time()
        return all(self.books[k].bids and self.books[k].asks and now - self.books[k].ts < lim for k in ("A", "B"))

    # ---------- 信号 ----------
    def cost_bp(self):
        """一个完整来回 (4 腿) 的费用 + 滑点, bp"""
        s = self.cfg["signal"]["slippage_bp"]
        return 2 * (self.fee_bp["A"] + self.fee_bp["B"]) + 4 * s

    def eff_spread(self, sell_k, buy_k, qty):
        """现在 在 sell_k 卖、在 buy_k 买, 按 qty 的 VWAP 算, 能拿到多少 bp (未扣费)"""
        ps = self.books[sell_k].vwap("sell", qty); pb = self.books[buy_k].vwap("buy", qty)
        if ps is None or pb is None: return None
        m = (self.books["A"].mid() + self.books["B"].mid()) / 2
        return (ps - pb) / m * 1e4

    def update_basis(self):
        m_a, m_b = self.books["A"].mid(), self.books["B"].mid()
        bp = (m_a - m_b) / ((m_a + m_b) / 2) * 1e4
        now = time.time(); self.basis_hist.append((now, bp))
        w = self.cfg["signal"]["z_window_s"]
        while self.basis_hist and now - self.basis_hist[0][0] > w: self.basis_hist.popleft()
        if len(self.basis_hist) < 60: return bp, None
        xs = [x for _, x in self.basis_hist]
        sd = statistics.pstdev(xs)
        return bp, ((bp - statistics.fmean(xs)) / sd if sd > 1e-9 else None)

    # ---------- 执行 ----------
    async def place(self, k, side, qty, ref_px):
        """IOC 限价, 保护价 = 参考价 ± 3 bp。paper 模式按 VWAP 模拟。返回 (filled_qty, avg_px)"""
        if self.paper:
            px = self.books[k].vwap(side, qty)
            return (qty, px) if px else (0.0, None)
        prot = ref_px * (1 + 3e-4) if side == "buy" else ref_px * (1 - 3e-4)
        contracts = math.floor(qty / self.csize[k] + 1e-9)        # 币 → 张 (向下取整)
        if contracts <= 0: return 0.0, None
        o = await self.ex[k].create_order(self.sym, "limit", side, contracts, prot, {"timeInForce": "IOC"})
        for _ in range(10):
            o = await self.ex[k].fetch_order(o["id"], self.sym)
            if o["status"] in ("closed", "canceled", "rejected", "expired"): break
            await asyncio.sleep(0.2)
        return float(o.get("filled") or 0) * self.csize[k], (float(o["average"]) if o.get("average") else None)

    async def two_legs(self, sell_k, buy_k, qty):
        ps = self.books[sell_k].vwap("sell", qty); pb = self.books[buy_k].vwap("buy", qty)
        r_sell, r_buy = await asyncio.gather(self.place(sell_k, "sell", qty, ps), self.place(buy_k, "buy", qty, pb))
        fs, pxs = r_sell; fb, pxb = r_buy
        # 单腿修补
        for _ in range(self.cfg["risk"]["leg_retry"]):
            if abs(fs - fb) < 1e-9: break
            if fs > fb:
                add, px = await self.place(buy_k, "buy", fs - fb, self.books[buy_k].asks[0][0] * 1.0005)
                if add: pxb = ((pxb or px) * fb + px * add) / (fb + add); fb += add
            else:
                add, px = await self.place(sell_k, "sell", fb - fs, self.books[sell_k].bids[0][0] * 0.9995)
                if add: pxs = ((pxs or px) * fs + px * add) / (fs + add); fs += add
            await asyncio.sleep(0.3)
        if abs(fs - fb) > 1e-9:   # 仍然不平 → 把多出来的腿平掉, 停机
            self.log.error(f"LEG MISMATCH sell={fs} buy={fb}, flattening and halting")
            if fs > fb: await self.place(sell_k, "buy", fs - fb, self.books[sell_k].asks[0][0] * 1.001); fs = fb
            else:       await self.place(buy_k, "sell", fb - fs, self.books[buy_k].bids[0][0] * 0.999); fb = fs
            self.st.halted = True
        sgn = {sell_k: -1, buy_k: +1}
        self.st.pos_A += sgn["A"] * fs; self.st.pos_B += sgn["B"] * fb
        fee = fs * (pxs or 0) * self.fee_bp[sell_k] / 1e4 + fb * (pxb or 0) * self.fee_bp[buy_k] / 1e4
        self.st.fees += fee; self.st.realized += (fs * (pxs or 0) - fb * (pxb or 0)) - fee
        self._save_state()
        return fs, pxs, pxb

    # ---------- 风控 ----------
    async def risk_ok_to_open(self):
        r = self.cfg["risk"]; sz = self.cfg["sizing"]
        if self.st.halted: return False
        if self.st.day_pnl < -r["daily_loss_limit_usdt"]:
            self.log.error("daily loss limit hit"); self.st.halted = True; return False
        if abs(self.st.pos_A + self.st.pos_B) > r["max_net_delta"]:
            self.log.error(f"net delta {self.st.pos_A + self.st.pos_B}"); return False
        if max(abs(self.st.pos_A), abs(self.st.pos_B)) + sz["clip"] > sz["max_position"]: return False
        if not self.paper:
            for k in ("A", "B"):
                try:
                    bal = await self.ex[k].fetch_balance({"type": "swap"})
                    tot = float(bal["USDT"]["total"] or 0); free = float(bal["USDT"]["free"] or 0)
                    notional = abs(self.st.pos_A if k == "A" else self.st.pos_B) * self.books[k].mid()
                    if tot <= 0 or free / tot < r["margin_ratio_floor"] or notional / tot > sz["max_leverage"]:
                        self.log.warning(f"[{k}] margin guard: free/tot={free/tot:.2f} lev={notional/tot:.2f}"); return False
                except Exception as e:
                    self.log.warning(f"[{k}] balance error {e}"); return False
        return True

    def funding_guard(self):
        """8 小时结算 (00/08/16 UTC) 前 N 分钟, 若持仓方向要付费率, 返回 True 提示提前平"""
        r = self.cfg["risk"]; now = time.time()
        secs_to = (8 * 3600) - (now % (8 * 3600))
        return secs_to < r["funding_guard_min"] * 60 and getattr(self, "fund_pay_bp", 0) > r["funding_guard_bp"]

    # ---------- 主循环 ----------
    async def run(self):
        sig = self.cfg["signal"]; clip = self.cfg["sizing"]["clip"]
        tasks = [asyncio.create_task(self.watch("A")), asyncio.create_task(self.watch("B"))]
        last_print = 0
        try:
            while not self.st.halted:
                await asyncio.sleep(0.05)
                day = time.strftime("%Y-%m-%d")
                if day != self.st.day: self.st.day, self.st.day_pnl = day, 0.0
                if not self.fresh(): continue
                basis, z = self.update_basis()
                s_AB = self.eff_spread("A", "B", clip)   # 卖 A 买 B
                s_BA = self.eff_spread("B", "A", clip)   # 卖 B 买 A
                if s_AB is None or s_BA is None: continue
                cost = self.cost_bp(); need = cost + sig["min_edge_bp"]
                flat = abs(self.st.pos_A) < 1e-9 and abs(self.st.pos_B) < 1e-9
                if time.time() - last_print > 10:
                    self.log.info(f"basis={basis:+.2f}bp z={'%.2f' % z if z is not None else 'na'} sAB={s_AB:+.2f} sBA={s_BA:+.2f} need={need:.2f} posA={self.st.pos_A:+.4f} posB={self.st.pos_B:+.4f} pnl={self.st.realized:.2f} trips={self.st.trips}")
                    last_print = time.time()
                # ---- 开仓: 整个来回的预期 = 现在拿到的 + 预期回到 0 基差时的反向价差 (≈ -own spreads) ----
                if flat and z is not None and abs(z) >= sig["z_entry"] and await self.risk_ok_to_open():
                    if s_AB >= need / 2 and z > 0:
                        q, pxs, pxb = await self.two_legs("A", "B", clip); self.st.entry_bp = s_AB; self._save_state()
                        self.log.info(f"OPEN sellA/buyB qty={q} {pxs}/{pxb} eff={s_AB:.2f}bp z={z:.2f}")
                    elif s_BA >= need / 2 and z < 0:
                        q, pxs, pxb = await self.two_legs("B", "A", clip); self.st.entry_bp = s_BA; self._save_state()
                        self.log.info(f"OPEN sellB/buyA qty={q} {pxs}/{pxb} eff={s_BA:.2f}bp z={z:.2f}")
                # ---- 平仓: 反向有效价差 + 开仓价差 - 费用 >= min_edge, 或 z 回归且不亏, 或 费率守卫 ----
                elif not flat:
                    rev = s_BA if self.st.pos_A < 0 else s_AB     # 持 A 空 B 多 → 平仓是 卖 B 买 A
                    total = self.st.entry_bp + rev - cost
                    z_back = z is not None and abs(z) <= sig["z_exit"]
                    if total >= sig["min_edge_bp"] or (z_back and total >= 0) or (self.funding_guard() and total > -cost):
                        q = abs(self.st.pos_A)
                        if self.st.pos_A < 0: await self.two_legs("B", "A", q)
                        else:                 await self.two_legs("A", "B", q)
                        self.st.trips += 1; self.st.day_pnl = self.st.realized
                        self.log.info(f"CLOSE qty={q} rev={rev:.2f}bp roundtrip_net={total:.2f}bp pnl={self.st.realized:.2f}")
                        self._save_state()
        finally:
            for t in tasks: t.cancel()
            for e in self.ex.values(): await e.close()

def main():
    cfg = load_config(sys.argv[1] if len(sys.argv) > 1 else "config.yaml")
    os.makedirs(cfg.get("log_dir", "./logs"), exist_ok=True)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.StreamHandler(), logging.FileHandler(os.path.join(cfg.get("log_dir", "./logs"), "xarb.log"))])
    bot = XArb(cfg)
    loop = asyncio.new_event_loop()
    def stop(*_): bot.st.halted = True
    for s in (signal.SIGINT, signal.SIGTERM): loop.add_signal_handler(s, stop)
    loop.run_until_complete(bot.run())

if __name__ == "__main__":
    main()
