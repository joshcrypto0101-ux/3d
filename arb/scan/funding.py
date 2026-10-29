import requests, json
S=requests.Session(); S.headers["User-Agent"]="Mozilla/5.0"
out={}
def g(u): return S.get(u,timeout=6).json()
for c in ["BTC","ETH"]:
    r={}
    try: d=g(f"https://www.okx.com/api/v5/public/funding-rate?instId={c}-USDT-SWAP")["data"][0]; r["okx"]=(float(d["fundingRate"]),8)
    except Exception as e: r["okx"]=str(e)[:40]
    try: d=g(f"https://api.bitget.com/api/v2/mix/market/current-fund-rate?symbol={c}USDT&productType=USDT-FUTURES")["data"][0]; r["bitget"]=(float(d["fundingRate"]),int(d.get("fundingRateInterval",8)))
    except Exception as e: r["bitget"]=str(e)[:40]
    try: d=g(f"https://api.gateio.ws/api/v4/futures/usdt/contracts/{c}_USDT"); r["gate"]=(float(d["funding_rate"]),d["funding_interval"]//3600)
    except Exception as e: r["gate"]=str(e)[:40]
    try: d=g(f"https://api-futures.kucoin.com/api/v1/contracts/{'XBTUSDTM' if c=='BTC' else 'ETHUSDTM'}")["data"]; r["kucoin"]=(float(d["fundingFeeRate"]),d["fundingRateGranularity"]//3600000)
    except Exception as e: r["kucoin"]=str(e)[:40]
    try: d=g(f"https://contract.mexc.com/api/v1/contract/funding_rate/{c}_USDT")["data"]; r["mexc"]=(float(d["fundingRate"]),d["collectCycle"])
    except Exception as e: r["mexc"]=str(e)[:40]
    try: d=g(f"https://api.hbdm.com/linear-swap-api/v1/swap_funding_rate?contract_code={c}-USDT")["data"]; r["htx"]=(float(d["funding_rate"]),8)
    except Exception as e: r["htx"]=str(e)[:40]
    try: d=g(f"https://open-api.bingx.com/openApi/swap/v2/quote/premiumIndex?symbol={c}-USDT")["data"]; r["bingx"]=(float(d["lastFundingRate"]),8)
    except Exception as e: r["bingx"]=str(e)[:40]
    try:
        d=S.post("https://api.hyperliquid.xyz/info",json={"type":"metaAndAssetCtxs"},timeout=6).json()
        idx=[i for i,u in enumerate(d[0]["universe"]) if u["name"]==c][0]; r["hyperliquid"]=(float(d[1][idx]["funding"]),1)
    except Exception as e: r["hyperliquid"]=str(e)[:40]
    try: d=g(f"https://api.phemex.com/md/v2/ticker/24hr?symbol={c}USDT")["result"]; r["phemex"]=(float(d["fundingRateRr"]),8)
    except Exception as e: r["phemex"]=str(e)[:40]
    try: d=g(f"https://fapi.asterdex.com/fapi/v1/premiumIndex?symbol={c}USDT"); r["aster"]=(float(d["lastFundingRate"]),8)
    except Exception as e: r["aster"]=str(e)[:40]
    try: d=g(f"https://api.backpack.exchange/api/v1/markPrices?symbol={c}_USDC_PERP")[0]; r["backpack"]=(float(d["fundingRate"]),8)
    except Exception as e: r["backpack"]=str(e)[:40]
    try: d=g(f"https://api.prod.paradex.trade/v1/funding/data?market={c}-USD-PERP&page_size=1")["results"][0]; r["paradex"]=(float(d["funding_rate"]),8)
    except Exception as e: r["paradex"]=str(e)[:40]
    try: d=g(f"https://api.bytick.com/v5/market/tickers?category=linear&symbol={c}USDT")["result"]["list"][0]; r["bybit"]=(float(d["fundingRate"]),8)
    except Exception as e: r["bybit"]=str(e)[:40]
    out[c]=r
print(json.dumps(out,indent=1))
