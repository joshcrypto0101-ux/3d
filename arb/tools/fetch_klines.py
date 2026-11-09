"""Download ~30 days of 5m klines for BTC-USDT-SWAP and ETH-USDT-SWAP from OKX public API."""
import requests, time, sys, json, os
import pandas as pd
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
BASE = "https://www.okx.com/api/v5/market/history-candles"
def fetch(inst, bar="5m", days=30):
    rows = []
    after = None
    need = days * 24 * 60 // 5
    while len(rows) < need:
        params = {"instId": inst, "bar": bar, "limit": 100}
        if after: params["after"] = after
        for attempt in range(5):
            try:
                r = requests.get(BASE, params=params, timeout=20)
                j = r.json()
                if j.get("code") == "0": break
                print("retry", j, file=sys.stderr); time.sleep(1)
            except Exception as e:
                print("err", e, file=sys.stderr); time.sleep(1)
        data = j["data"]
        if not data: break
        rows.extend(data)
        after = data[-1][0]
        time.sleep(0.12)
    df = pd.DataFrame(rows, columns=["ts","o","h","l","c","vol","volCcy","volCcyQuote","confirm"])
    df["ts"] = pd.to_datetime(df["ts"].astype("int64"), unit="ms", utc=True)
    for col in ["o","h","l","c"]: df[col] = df[col].astype(float)
    df = df.sort_values("ts").drop_duplicates("ts").reset_index(drop=True)
    return df
for inst in ["BTC-USDT-SWAP", "ETH-USDT-SWAP"]:
    df = fetch(inst)
    df.to_csv(f"{OUT}/{inst}_5m.csv", index=False)
    print(inst, len(df), df.ts.min(), df.ts.max())
