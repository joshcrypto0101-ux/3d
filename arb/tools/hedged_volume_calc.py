#!/usr/bin/env python3
"""
Hedged-volume economics calculator.

Models a delta-neutral pair: long perp on account/venue A, short perp on account/venue B,
equal notional N, both legs isolated margin at leverage L. Computes:
  * realized vol from OKX 5m klines (BTC, ETH), hourly sigma in bp
  * P(one leg liquidated within T) at several leverages, via
      (a) empirical historical-window method on 5m high/low paths
      (b) driftless Brownian two-sided first-passage (closed-form series)
  * expected liquidation cost per leg (% of notional)
  * cost per $1M of exchange-counted volume under fee/rebate scenarios
  * breakeven incentive per $1M volume, and capital turnover for a 20k USDT account pair

Volume convention (as exchanges count it): every fill's notional counts. One hedged round
trip of notional N on two accounts = 4 fills = 4N volume (same exchange) or 2N per exchange.

Usage:
  python3 -I hedged_volume_calc.py --data-dir DATA [--taker-bp 5.5 --maker-bp 2 --mmr-pct 0.4
        --liq-fee-bp 5.5 --leverage 20 --hold-hours 1 --capital 20000 --trips-per-day 10]
All numbers are USD / bp / percent as labeled.
"""
import argparse, json, math, os, sys
import numpy as np
import pandas as pd

# --------------------------------------------------------------------------------------
# 1. Fee / margin table (base tier). Values verified from public API or official docs on
#    2026-11-09 unless flagged "estimate". bp = basis points (1 bp = 0.01%).
# --------------------------------------------------------------------------------------
FEE_TABLE = [
 dict(venue="OKX", taker_bp=5.0, maker_bp=2.0, liquidation_fee_bp=5.0, max_leverage_btc=100,
      maint_margin_pct_btc_at_max_lev=0.40,
      note="Lv1 regular user 0.05%/0.02% (okx.com/help/how-to-calculate-the-contract-transaction-fee). Liquidation fee = your taker rate, plus possible 'clearance fee' (okx.com/help/v-tiered-maintenance-margin-ratio-rules). MMR 0.4%/IMR 1%/100x tier1 from /api/v5/public/position-tiers BTC-USDT SWAP (verified)."),
 dict(venue="Bitget", taker_bp=6.0, maker_bp=2.0, liquidation_fee_bp=6.0, max_leverage_btc=150,
      maint_margin_pct_btc_at_max_lev=0.40,
      note="API /api/v2/mix/market/contracts: taker 0.0006, maker 0.0002, maxLever 150; query-position-lever tier1 keepMarginRate 0.004 (verified). Liquidation fee rate 0.06% per Bitget support article 12560603812664 (verified)."),
 dict(venue="Gate", taker_bp=5.0, maker_bp=2.0, liquidation_fee_bp=5.0, max_leverage_btc=200,
      maint_margin_pct_btc_at_max_lev=0.30,
      note="VIP0 perp 0.05%/0.02% per gate.com/learn fees article (verified; NB the contracts API still returns legacy taker_fee_rate 0.00075 / maker -0.0001). API BTC_USDT maintenance_rate 0.003, leverage_max 200, order_price_deviate 0.03 (verified). No separate liquidation fee: taker fee is built into bankruptcy price; remaining margin goes to insurance fund."),
 dict(venue="KuCoin", taker_bp=6.0, maker_bp=2.0, liquidation_fee_bp=6.0, max_leverage_btc=125,
      maint_margin_pct_btc_at_max_lev=0.40,
      note="API /api/v1/contracts/XBTUSDTM: taker 0.0006, maker 0.0002, maintainMargin 0.004, initialMargin 0.008, maxLeverage 125 (verified). Liquidation price formula adds taker fee rate (0.06%) to MMR (kucoin.com/support/35084431335065)."),
 dict(venue="MEXC", taker_bp=2.0, maker_bp=0.0, liquidation_fee_bp=4.0, max_leverage_btc=500,
      maint_margin_pct_btc_at_max_lev=0.10,
      note="API contract/detail BTC_USDT: takerFeeRate 0.0002, makerFeeRate 0, maxLeverage 500, maintenanceMarginRate 0.001, initialMarginRate 0.002, liquidationFeeRate 0.0004 (verified). WARNING: API-placed futures orders are on a separate schedule: 0.01% maker / 0.05% taker from 2026-03-31 (mexc.com API announcement), one secondary source says raised again 2026-06-01; API traders excluded from 0-fee promos."),
 dict(venue="HTX", taker_bp=6.0, maker_bp=2.0, liquidation_fee_bp=0.0, max_leverage_btc=200,
      maint_margin_pct_btc_at_max_lev=0.30,
      note="Prime0 maker 0.02% / taker 0.06% per htx.com/support/900000089923 (official but dated; many third parties quote 0.05% taker - verify in account). MMR = adjustment_factor/leverage: swap_adjustfactor API BTC-USDT isolated 200x factor 0.6 -> 0.30%, 100x 0.4 -> 0.40% (verified). No explicit liquidation fee; position taken over at bankruptcy price, all remaining margin to insurance fund."),
 dict(venue="BingX", taker_bp=5.0, maker_bp=2.0, liquidation_fee_bp=5.0, max_leverage_btc=150,
      maint_margin_pct_btc_at_max_lev=0.50,
      note="API quote/contracts BTC-USDT takerFeeRate 0.0005 makerFeeRate 0.0002 (verified); max 150x (bingx.com/en/support/articles/22260528334617). MMR 0.5% for BTC with liquidation trigger = MMR + taker fee (bingx support 11263299509391; BingX says MMR may be tiered for some pairs since Oct 2026)."),
 dict(venue="Hyperliquid", taker_bp=4.5, maker_bp=1.5, liquidation_fee_bp=0.0, max_leverage_btc=40,
      maint_margin_pct_btc_at_max_lev=1.25,
      note="Tier0 taker 0.045% / maker 0.015% (hyperliquid.gitbook.io fees). /info meta: BTC maxLeverage 40 (verified). MMR = half of IM at max leverage = 1.25%. No clearance fee; book liquidation returns leftover margin, backstop liquidation (equity < 2/3 MM) takes all margin."),
 dict(venue="Aster", taker_bp=4.0, maker_bp=0.0, liquidation_fee_bp=250.0, max_leverage_btc=1001,
      maint_margin_pct_btc_at_max_lev=0.05,
      note="docs.asterdex.com fees: crypto general maker 0% / taker 0.04% (verified). exchangeInfo BTCUSDT liquidationFee 0.025 (=2.5% clearance fee, Binance-style field; verified field, interpretation estimate). 1001x advertised (Simple mode); BTC tier-1 MMR at 1001x is an ESTIMATE (leverageBracket endpoint needs API key; IMR 0.1% implies MMR <0.1%)."),
 dict(venue="Lighter", taker_bp=0.0, maker_bp=0.0, liquidation_fee_bp=100.0, max_leverage_btc=50,
      maint_margin_pct_btc_at_max_lev=1.20,
      note="Standard account 0/0; Premium 0.028%/0.004% (docs.lighter.xyz/trading/trading-fees, verified). orderBookDetails BTC: min IMF 2.00% (=50x), MMF 1.20%, closeout 0.80%, liquidation_fee up to 1% (verified)."),
 dict(venue="Backpack", taker_bp=5.0, maker_bp=2.0, liquidation_fee_bp=100.0, max_leverage_btc=75,
      maint_margin_pct_btc_at_max_lev=0.667,
      note="Tier1 perp maker 0.02% / taker 0.05% (support.backpack.exchange/exchange/trading-fees, verified). Liquidation fee 1% per fill (Backpack EU docs). markets API BTC_USDC_PERP imf base 0.01333 (=75x), mmf base 0.00667 (+sqrt-size factor) (verified)."),
 dict(venue="Paradex", taker_bp=2.0, maker_bp=0.0, liquidation_fee_bp=70.0, max_leverage_btc=50,
      maint_margin_pct_btc_at_max_lev=1.00,
      note="Live markets API fee_config: api taker 0.0002, maker 0; UI (interactive) 0/0 (verified). docs.paradex.trade fee page lists Pro0 taker 0.045%/maker 0.003% - conflict, verify in account. imf_base 0.02 (50x), mmf_factor 0.5 -> MMF 1%. Liquidation penalty = 70% of MMR = 0.7% (docs.paradex.trade/risk/liquidations)."),
]

# --------------------------------------------------------------------------------------
# 2. Realized vol from klines
# --------------------------------------------------------------------------------------
def load_klines(path):
    df = pd.read_csv(path, parse_dates=["ts"])
    return df.sort_values("ts").reset_index(drop=True)

def realized_vol(df, bar_minutes=5):
    r = np.log(df.c).diff().dropna().values
    sig_bar = r.std(ddof=1)
    per_year = 365 * 24 * 60 / bar_minutes
    ann = sig_bar * math.sqrt(per_year)
    hourly_bp = sig_bar * math.sqrt(60 / bar_minutes) * 1e4
    daily_bp = sig_bar * math.sqrt(1440 / bar_minutes) * 1e4
    return dict(ann_pct=100 * ann, hourly_sigma_bp=hourly_bp, daily_sigma_bp=daily_bp,
                n_bars=len(r), start=str(df.ts.iloc[0]), end=str(df.ts.iloc[-1]),
                kurtosis_5m=float(pd.Series(r).kurt()))

# --------------------------------------------------------------------------------------
# 3. Liquidation probabilities
# --------------------------------------------------------------------------------------
def liq_distance(leverage, mmr_pct, liq_fee_bp, open_fee_bp=0.0):
    """Adverse move (fraction) that triggers liquidation of an isolated leg.
    equity = 1/L - x - open_fee  <=  MMR + liq_fee  ->  x >= 1/L - MMR - liq_fee - open_fee."""
    d = 1.0 / leverage - mmr_pct / 100 - liq_fee_bp / 1e4 - open_fee_bp / 1e4
    return max(d, 0.0)

def p_two_sided_brownian(d, sigma_per_hour, hours, terms=200):
    """P(|W_t| hits d for some t<=T), driftless BM with std sigma*sqrt(T).
    1 - (4/pi) * sum_{k=0..} (-1)^k/(2k+1) * exp(-(2k+1)^2 pi^2 s^2 / (8 d^2)), s^2 = sigma^2 T."""
    if d <= 0: return 1.0
    s2 = (sigma_per_hour ** 2) * hours
    acc = 0.0
    for k in range(terms):
        n = 2 * k + 1
        acc += ((-1) ** k) / n * math.exp(-(n ** 2) * (math.pi ** 2) * s2 / (8 * d * d))
    return float(min(max(1 - 4 / math.pi * acc, 0.0), 1.0))

def p_empirical(df, d, hours, bar_minutes=5):
    """Historical-window method: for every bar start, did the price path (using bar highs/lows)
    move >= d up OR down relative to entry (close of start bar) within the next `hours`?
    Pair liquidation = either leg liquidated = two-sided barrier."""
    n = len(df); w = int(hours * 60 / bar_minutes)
    c = df.c.values; h = df.h.values; l = df.l.values
    hits = 0; total = 0
    # running max/min via sliding window on log ratios
    logc = np.log(c); logh = np.log(h); logl = np.log(l)
    up = logh - np.concatenate(([np.nan], logc[:-1]))  # placeholder not used
    for i in range(0, n - w - 1):
        entry = logc[i]
        hi = logh[i + 1:i + 1 + w].max() - entry
        lo = entry - logl[i + 1:i + 1 + w].min()
        total += 1
        if hi >= d or lo >= d: hits += 1
    return hits / total if total else float("nan")

def liquidation_table(df, sigma_h, leverages, mmr_pct, liq_fee_bp, open_fee_bp, reopen_cost_bp,
                      horizons=(1, 8, 24), method="empirical"):
    out = []
    for L in leverages:
        d = liq_distance(L, mmr_pct, liq_fee_bp, open_fee_bp)
        row = dict(leverage=L, liq_distance_pct=round(100 * d, 4))
        for hrs in horizons:
            pe = p_empirical(df, d, hrs)
            pb = p_two_sided_brownian(d, sigma_h, hrs)
            row[f"prob_liq_within_{hrs}h_pct_empirical"] = round(100 * pe, 3)
            row[f"prob_liq_within_{hrs}h_pct_brownian"] = round(100 * pb, 3)
        # cost given liquidation, per liquidated leg, % of notional:
        #   position taken over at bankruptcy price -> lose MMR gap + liquidation fee
        #   (hedge gained the move up to liq price, so net loss = 1/L - d = MMR + liq fee)
        #   + cost to re-open the leg (taker fee net of rebate + half-spread)
        cost_given = mmr_pct + liq_fee_bp / 100 + reopen_cost_bp / 100  # in % of notional
        row["cost_given_liquidation_pct_of_notional"] = round(cost_given, 4)
        for hrs in horizons:
            p = pe if method == "empirical" else pb
            p = row[f"prob_liq_within_{hrs}h_pct_{method}"] / 100
            # pair has 2 legs but only one can be liquidated per event (two-sided barrier counted once)
            row[f"expected_liq_cost_per_leg_pct_{hrs}h"] = round(p * cost_given / 2, 5)  # averaged over the 2 legs
            row[f"expected_liq_cost_per_pair_event_pct_{hrs}h"] = round(p * cost_given, 5)
        out.append(row)
    return out

# --------------------------------------------------------------------------------------
# 4. Cost per $1M volume
# --------------------------------------------------------------------------------------
def cost_per_1m(taker_bp, maker_bp, rebate, maker_share, spread_bp_per_taker_leg,
                p_liq_pair, cost_given_liq_pct, volume_per_round_trip_mult=4):
    """Volume = exchange-counted volume. One hedged round trip of notional N = 4N volume.
    maker_share = fraction of fills that are maker (0 for taker-taker, 0.5 for maker-taker).
    rebate applies to fee actually paid (both maker and taker)."""
    V = 1_000_000
    gross_fee = V * ((1 - maker_share) * taker_bp + maker_share * maker_bp) / 1e4
    net_fee = gross_fee * (1 - rebate)
    spread = V * (1 - maker_share) * spread_bp_per_taker_leg / 1e4
    # liquidation: per round trip of notional N, expected cost = p_pair * cost_given * N; volume = 4N
    N = V / volume_per_round_trip_mult
    liq = p_liq_pair * cost_given_liq_pct / 100 * N
    return dict(fee_cost_usd=round(net_fee, 2), gross_fee_usd=round(gross_fee, 2),
                rebate_usd=round(gross_fee - net_fee, 2), spread_slippage_usd=round(spread, 2),
                liquidation_cost_usd=round(liq, 2), total_usd=round(net_fee + spread + liq, 2))

# --------------------------------------------------------------------------------------
# 5. Capital turnover
# --------------------------------------------------------------------------------------
def capital_turnover(capital_per_account, leverage, trips_per_day, taker_bp, rebate, utilization=1.0,
                     days=30, same_exchange=True):
    N = capital_per_account * leverage * utilization   # notional per leg
    fills_per_trip = 4                                  # open+close on each of 2 accounts
    vol_day_pair = N * fills_per_trip * trips_per_day
    vol_month_pair = vol_day_pair * days
    gross = vol_month_pair * taker_bp / 1e4
    return dict(notional_per_leg_usd=N, volume_per_day_pair_usd=vol_day_pair,
                volume_per_day_per_exchange_usd=vol_day_pair if same_exchange else vol_day_pair / 2,
                volume_per_month_pair_usd=vol_month_pair,
                monthly_gross_fee_usd=round(gross, 2), monthly_rebate_usd=round(gross * rebate, 2),
                monthly_net_fee_usd=round(gross * (1 - rebate), 2))

# --------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--taker-bp", type=float, default=5.5, help="representative taker fee (user venues 5-6 bp)")
    ap.add_argument("--maker-bp", type=float, default=2.0)
    ap.add_argument("--mmr-pct", type=float, default=0.4, help="maintenance margin %% (BTC tier1 typical CEX)")
    ap.add_argument("--liq-fee-bp", type=float, default=5.5, help="liquidation fee bp (CEX: = taker rate)")
    ap.add_argument("--spread-bp", type=float, default=0.5, help="half-spread+slippage per taker leg")
    ap.add_argument("--leverage", type=float, default=20)
    ap.add_argument("--hold-hours", type=float, default=1)
    ap.add_argument("--rebate", type=float, default=0.8)
    ap.add_argument("--capital", type=float, default=20000)
    ap.add_argument("--trips-per-day", type=float, default=10)
    ap.add_argument("--utilization", type=float, default=1.0)
    ap.add_argument("--symbol", default="BTC-USDT-SWAP")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    btc = load_klines(os.path.join(a.data_dir, "BTC-USDT-SWAP_5m.csv"))
    eth = load_klines(os.path.join(a.data_dir, "ETH-USDT-SWAP_5m.csv"))
    vb, ve = realized_vol(btc), realized_vol(eth)
    df = btc if a.symbol.startswith("BTC") else eth
    sig_h = (vb if a.symbol.startswith("BTC") else ve)["hourly_sigma_bp"] / 1e4

    # re-open cost after liquidation: one taker fill net of rebate + half spread
    reopen_bp = a.taker_bp * (1 - a.rebate) + a.spread_bp
    open_fee_bp = a.taker_bp  # opening fee is deducted from isolated margin before rebate arrives
    liq_tab = liquidation_table(df, sig_h, [10, 20, 50, 100], a.mmr_pct, a.liq_fee_bp, open_fee_bp, reopen_bp)

    # chosen leverage/holding for cost scenarios
    d = liq_distance(a.leverage, a.mmr_pct, a.liq_fee_bp, open_fee_bp)
    p_pair = p_empirical(df, d, a.hold_hours)
    p_pair_bm = p_two_sided_brownian(d, sig_h, a.hold_hours)
    cost_given = a.mmr_pct + a.liq_fee_bp / 100 + reopen_bp / 100

    scen = []
    for name, ms, reb in [("taker-taker, 0% rebate", 0.0, 0.0), ("taker-taker, 80% rebate", 0.0, 0.8),
                          ("taker-taker, 90% rebate", 0.0, 0.9), ("maker-taker, 80% rebate", 0.5, 0.8),
                          ("maker-maker, 80% rebate", 1.0, 0.8)]:
        c = cost_per_1m(a.taker_bp, a.maker_bp, reb, ms, a.spread_bp, p_pair, cost_given)
        c["scenario"] = name
        scen.append(c)
    # zero-liquidation-risk variant (hold seconds / both sides on one cross account)
    scen_noliq = cost_per_1m(a.taker_bp, a.maker_bp, 0.8, 0.0, a.spread_bp, 0.0, cost_given)
    scen_noliq["scenario"] = "taker-taker, 80% rebate, no liquidation exposure (hold < 1 min or hedge-mode same account)"
    scen.append(scen_noliq)

    turn = {L: capital_turnover(a.capital, L, a.trips_per_day, a.taker_bp, a.rebate, a.utilization) for L in [10, 20, 50, 100]}

    out = dict(params=vars(a), realized_vol=dict(BTC=vb, ETH=ve),
               liq_distance_pct_at_chosen=100 * d,
               p_liq_pair_chosen=dict(empirical=p_pair, brownian=p_pair_bm, leverage=a.leverage, hold_hours=a.hold_hours),
               cost_given_liq_pct=cost_given, liquidation_table=liq_tab, cost_per_1m=scen,
               breakeven_incentive_per_1m_usd={s["scenario"]: s["total_usd"] for s in scen},
               capital_turnover=turn, fee_table=FEE_TABLE)
    print(json.dumps(out, indent=2, default=str))

if __name__ == "__main__":
    main()
