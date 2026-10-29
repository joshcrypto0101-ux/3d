import requests, json, time, csv, sys, threading, os
from concurrent.futures import ThreadPoolExecutor
S = requests.Session(); S.headers["User-Agent"]="Mozilla/5.0"
DUR = int(sys.argv[1]) if len(sys.argv)>1 else 900
OUT = sys.argv[2] if len(sys.argv)>2 else "book.csv"

def lv(a, pi=0, si=1, mult=1.0):
    return [(float(x[pi]), float(x[si])*mult) for x in a]

def okx(c):
    d=S.get(f"https://www.okx.com/api/v5/market/books?instId={c}-USDT-SWAP&sz=5",timeout=5).json()["data"][0]
    m={"BTC":0.01,"ETH":0.1}[c]; return lv(d["bids"],0,1,m), lv(d["asks"],0,1,m)
def bitget(c):
    d=S.get(f"https://api.bitget.com/api/v2/mix/market/merge-depth?symbol={c}USDT&productType=USDT-FUTURES&limit=5",timeout=5).json()["data"]
    return lv(d["bids"]), lv(d["asks"])
def gate(c):
    d=S.get(f"https://api.gateio.ws/api/v4/futures/usdt/order_book?contract={c}_USDT&limit=5",timeout=5).json()
    m={"BTC":0.0001,"ETH":0.01}[c]
    return [(float(x["p"]),x["s"]*m) for x in d["bids"]], [(float(x["p"]),x["s"]*m) for x in d["asks"]]
def kucoin(c):
    sym={"BTC":"XBTUSDTM","ETH":"ETHUSDTM"}[c]; m={"BTC":0.001,"ETH":0.01}[c]
    d=S.get(f"https://api-futures.kucoin.com/api/v1/level2/depth20?symbol={sym}",timeout=5).json()["data"]
    return lv(d["bids"],0,1,m), lv(d["asks"],0,1,m)
def mexc(c):
    m={"BTC":0.0001,"ETH":0.01}[c]
    d=S.get(f"https://contract.mexc.com/api/v1/contract/depth/{c}_USDT?limit=5",timeout=5).json()["data"]
    return lv(d["bids"],0,1,m), lv(d["asks"],0,1,m)
def htx(c):
    m={"BTC":0.001,"ETH":0.01}[c]
    d=S.get(f"https://api.hbdm.com/linear-swap-ex/market/depth?contract_code={c}-USDT&type=step0",timeout=5).json()["tick"]
    return lv(d["bids"],0,1,m), lv(d["asks"],0,1,m)
def bingx(c):
    d=S.get(f"https://open-api.bingx.com/openApi/swap/v2/quote/depth?symbol={c}-USDT&limit=5",timeout=5).json()["data"]
    return lv(d["bids"]), lv(d["asks"])
def hyperliquid(c):
    d=S.post("https://api.hyperliquid.xyz/info",json={"type":"l2Book","coin":c},timeout=5).json()["levels"]
    return [(float(x["px"]),float(x["sz"])) for x in d[0][:5]], [(float(x["px"]),float(x["sz"])) for x in d[1][:5]]
def phemex(c):
    d=S.get(f"https://api.phemex.com/md/v2/orderbook?symbol={c}USDT",timeout=5).json()["result"]["orderbook_p"]
    return lv(d["bids"]), lv(d["asks"])
def aster(c):
    d=S.get(f"https://fapi.asterdex.com/fapi/v1/depth?symbol={c}USDT&limit=5",timeout=5).json()
    return lv(d["bids"]), lv(d["asks"])
def paradex(c):
    d=S.get(f"https://api.prod.paradex.trade/v1/orderbook/{c}-USD-PERP?depth=5",timeout=5).json()
    return lv(d["bids"]), lv(d["asks"])
def backpack(c):
    d=S.get(f"https://api.backpack.exchange/api/v1/depth?symbol={c}_USDC_PERP",timeout=5).json()
    bids=sorted(((float(p),float(q)) for p,q in d["bids"]),reverse=True)[:5]; asks=sorted(((float(p),float(q)) for p,q in d["asks"]))[:5]
    return bids, asks
def deribit(c):
    d=S.get(f"https://www.deribit.com/api/v2/public/get_order_book?instrument_name={c}_USDC-PERPETUAL&depth=5",timeout=5).json()["result"]
    return lv(d["bids"]), lv(d["asks"])
def whitebit(c):
    d=S.get(f"https://whitebit.com/api/v4/public/orderbook/{c}_PERP?limit=5",timeout=5).json()
    return lv(d["bids"]), lv(d["asks"])
def lighter(c):
    mid={"BTC":1,"ETH":0}[c]
    d=S.get(f"https://mainnet.zklighter.elliot.ai/api/v1/orderBookOrders?market_id={mid}&limit=5",timeout=5).json()
    return [(float(x["price"]),float(x["remaining_base_amount"])) for x in d["bids"][:5]], [(float(x["price"]),float(x["remaining_base_amount"])) for x in d["asks"][:5]]
def bybit(c):
    d=S.get(f"https://api.bytick.com/v5/market/orderbook?category=linear&symbol={c}USDT&limit=5",timeout=5).json()["result"]
    return lv(d["b"]), lv(d["a"])
def binance(c):   # 美国 IP 会返回 451, 需在允许地区运行
    d=S.get(f"https://fapi.binance.com/fapi/v1/depth?symbol={c}USDT&limit=5",timeout=5).json()
    return lv(d["bids"]), lv(d["asks"])
def bybit(c):     # 部分地区 403
    d=S.get(f"https://api.bybit.com/v5/market/orderbook?category=linear&symbol={c}USDT&limit=5",timeout=5).json()["result"]
    return lv(d["b"]), lv(d["a"])
def kraken(c):
    sym={"BTC":"PF_XBTUSD","ETH":"PF_ETHUSD"}[c]
    d=S.get(f"https://futures.kraken.com/derivatives/api/v3/orderbook?symbol={sym}",timeout=5).json()["orderBook"]
    return lv(d["bids"]), lv(d["asks"])

EX = {"binance":binance,"bybit":bybit,"okx":okx,"bitget":bitget,"gate":gate,"kucoin":kucoin,"mexc":mexc,"htx":htx,"bingx":bingx,
      "hyperliquid":hyperliquid,"phemex":phemex,"aster":aster,"paradex":paradex,"backpack":backpack,
      "deribit":deribit,"whitebit":whitebit,"lighter":lighter,"kraken":kraken}
COINS=["BTC","ETH"]
lock=threading.Lock()
f=open(OUT,"a",newline=""); w=csv.writer(f)
if os.path.getsize(OUT)==0:
    w.writerow(["ts","ex","coin","bid","bsz","ask","asz","bid5","bsz5","ask5","asz5","err"])
def job(ex,c):
    t=time.time()
    try:
        b,a=EX[ex](c)
        b=sorted(b,reverse=True)[:5]; a=sorted(a)[:5]
        row=[round(t,2),ex,c,b[0][0],round(b[0][1],4),a[0][0],round(a[0][1],4),b[-1][0],round(sum(x[1] for x in b),4),a[-1][0],round(sum(x[1] for x in a),4),""]
    except Exception as e:
        row=[round(t,2),ex,c,"","","","","","","","",type(e).__name__]
    with lock: w.writerow(row)
pool=ThreadPoolExecutor(40)
t0=time.time(); n=0
while time.time()-t0<DUR:
    ts=time.time()
    futs=[pool.submit(job,ex,c) for ex in EX for c in COINS]
    for ft in futs: ft.result()
    f.flush(); n+=1
    time.sleep(max(0,1.0-(time.time()-ts)))
print("rounds",n)
