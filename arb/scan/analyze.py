import pandas as pd, numpy as np, itertools, sys, json
F=sys.argv[1] if len(sys.argv)>1 else "book.csv"
d=pd.read_csv(F)
d=d[d.err.isna()].drop(columns="err")
NON_USDT={"kraken","backpack","deribit","paradex","lighter"}   # USD/USDC 保证金, 价差里混着 USDT 溢价
d=d[~d.ex.isin(NON_USDT)]
d["t"]=d.ts.round().astype(int)
d["mid"]=(d.bid+d.ask)/2
d["own_bp"]=(d.ask-d.bid)/d.mid*1e4
# per-venue quality
q=d.groupby(["coin","ex"]).agg(samples=("t","size"),own_spread_bp=("own_bp","median"),top_bid=("bsz","median"),top_ask=("asz","median"),bid5=("bsz5","median"),ask5=("asz5","median")).round(3)
print("=== venue quality (median) ==="); print(q.to_string())
# pairwise effective spreads: s = A.bid - B.ask  (sell A / buy B), in bp of avg mid
TH=[2,3,5,8,10,15]
rows=[]
opps={}
for coin in ["BTC","ETH"]:
    dc=d[d.coin==coin]
    piv_b=dc.pivot_table(index="t",columns="ex",values="bid")
    piv_a=dc.pivot_table(index="t",columns="ex",values="ask")
    piv_m=dc.pivot_table(index="t",columns="ex",values="mid")
    exs=[e for e in piv_b.columns if piv_b[e].notna().mean()>0.7]
    for A,B in itertools.permutations(exs,2):
        m=(piv_m[A]+piv_m[B])/2
        s=((piv_b[A]-piv_a[B])/m*1e4).dropna()   # profit bp if sell A buy B now
        if len(s)<30: continue
        # also mid-to-mid basis stats for z-score
        basis=((piv_m[A]-piv_m[B])/m*1e4).dropna()
        r={"coin":coin,"sellA":A,"buyB":B,"n":len(s),"basis_mean":basis.mean(),"basis_std":basis.std(),
           "eff_mean":s.mean(),"eff_p50":s.median(),"eff_p90":s.quantile(.9),"eff_p99":s.quantile(.99),"eff_max":s.max()}
        for th in TH: r[f"pct>{th}"]=(s>th).mean()*100
        rows.append(r)
R=pd.DataFrame(rows)
pd.set_option("display.width",250)
for coin in ["BTC","ETH"]:
    print(f"\n=== {coin}: best one-way effective spreads (sell A, buy B), bp ===")
    print(R[R.coin==coin].sort_values("eff_p90",ascending=False).head(15).round(2).to_string(index=False))
# round-trip opportunity counting for unordered pairs: enter when s_AB>th_in, exit when s_BA>-th_out (i.e., reverse leg cost small)
print("\n=== round-trip simulation per pair: enter if sell-A/buy-B eff spread > IN bp, close when reverse eff spread > OUT bp ===")
def sim(sAB,sBA,IN,OUT):
    pos=0; trips=0; pnl=0; hold=[]
    t_in=None
    for t,(x,y) in enumerate(zip(sAB,sBA)):
        if np.isnan(x) or np.isnan(y): continue
        if pos==0:
            if x>IN: pos=1; pnl_in=x; t_in=t
            elif y>IN: pos=-1; pnl_in=y; t_in=t
        elif pos==1 and y>OUT: pos=0; trips+=1; pnl+=pnl_in+y; hold.append(t-t_in)
        elif pos==-1 and x>OUT: pos=0; trips+=1; pnl+=pnl_in+x; hold.append(t-t_in)
    return trips,pnl,(np.median(hold) if hold else np.nan)
out=[]
for coin in ["BTC","ETH"]:
    dc=d[d.coin==coin]
    piv_b=dc.pivot_table(index="t",columns="ex",values="bid"); piv_a=dc.pivot_table(index="t",columns="ex",values="ask"); piv_m=dc.pivot_table(index="t",columns="ex",values="mid")
    exs=[e for e in piv_b.columns if piv_b[e].notna().mean()>0.7]
    T=(piv_b.index.max()-piv_b.index.min())/60
    for A,B in itertools.combinations(exs,2):
        m=(piv_m[A]+piv_m[B])/2
        sAB=((piv_b[A]-piv_a[B])/m*1e4).values; sBA=((piv_b[B]-piv_a[A])/m*1e4).values
        for IN,OUT in [(3,-1),(5,-1),(8,-2)]:
            tr,p,h=sim(sAB,sBA,IN,OUT)
            out.append({"coin":coin,"A":A,"B":B,"IN":IN,"OUT":OUT,"trips":tr,"trips_per_day":tr/T*1440,"gross_bp_total":p,"gross_bp_per_trip":p/tr if tr else 0,"median_hold_s":h})
O=pd.DataFrame(out)
for coin in ["BTC","ETH"]:
    print(f"\n--- {coin} ---")
    print(O[(O.coin==coin)&(O.trips>0)].sort_values("gross_bp_total",ascending=False).head(20).round(2).to_string(index=False))
print(f"\nsample window minutes: {T:.1f}")
R.to_csv("pairs.csv",index=False); O.to_csv("trips.csv",index=False); q.to_csv("venues.csv")
