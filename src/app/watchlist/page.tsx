import { getMarketSnapshot, getHeatmap, latestQuote } from "@/lib/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchlistRow } from "@/components/watchlist-row";
import { MarketBadge } from "@/components/market-badge";
import { Card } from "@/components/ui/card";

export const metadata = {
  title: "관심목록 · AI Quant Lab",
};

export default async function WatchlistPage() {
  const [snapshot, heatmap] = await Promise.all([getMarketSnapshot(), getHeatmap()]);

  // 섹터: XLV, XLE 등 11개 SPDR 섹터 ETF (1주 수익률 기준 정렬)
  const sectors = [...snapshot.sectors].sort((a, b) => b.ret_1w_pct - a.ret_1w_pct);

  // 원자재: DXY, Gold, Oil (market_snapshot의 commodities)
  const commodities = [
    { key: "gold", ...snapshot.commodities.gold },
    { key: "oil_wti", ...snapshot.commodities.oil_wti },
    { key: "dxy", ...snapshot.commodities.dxy },
  ];

  // 개별주 Top: 시가총액 기준 상위 30 (S&P500 캐시에서)
  const stocks = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const q = latestQuote(data);
      return q
        ? { ticker, name: data.name, sector: data.sector, market_cap: data.market_cap, ...q }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.market_cap - a.market_cap)
    .slice(0, 30);

  // 지수 프록시: VIX + SPY(=breadth.spy_close). 실제 지수 데이터는 아직 미제공.
  const indices = [
    {
      ticker: "SPY",
      name: "S&P 500 ETF",
      price: snapshot.breadth.spy_close,
      // 200일 이평선 대비 %
      changePct: ((snapshot.breadth.spy_close - snapshot.breadth.sma200) / snapshot.breadth.sma200) * 100,
      label: "vs SMA200",
    },
    {
      ticker: "^VIX",
      name: "Volatility Index",
      price: snapshot.vix.current,
      changePct: ((snapshot.vix.current - snapshot.vix.avg) / snapshot.vix.avg) * 100,
      label: "vs 6M avg",
    },
  ];

  const updatedAt = new Date(snapshot.updated_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">관심목록</h1>
          <MarketBadge />
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {updatedAt} KST · Data from stock-dashboard cache
        </p>
      </header>

      <Tabs defaultValue="sectors" className="w-full">
        <TabsList className="w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="indices" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            지수
          </TabsTrigger>
          <TabsTrigger value="sectors" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            섹터
          </TabsTrigger>
          <TabsTrigger value="commodities" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            원자재
          </TabsTrigger>
          <TabsTrigger value="stocks" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            개별주 Top 30
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indices" className="mt-4">
          <Card className="divide-y divide-border/40 p-2">
            {indices.map((row, i) => (
              <WatchlistRow
                key={row.ticker}
                rank={i + 1}
                primary={row.name}
                secondary={row.ticker}
                price={row.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                changePct={row.changePct}
                changeLabel={row.label}
              />
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="sectors" className="mt-4">
          <Card className="divide-y divide-border/40 p-2">
            {sectors.map((s, i) => (
              <WatchlistRow
                key={s.ticker}
                rank={i + 1}
                primary={s.sector}
                secondary={s.ticker}
                price={`${s.ret_1m_pct.toFixed(2)}%`}
                changePct={s.ret_1w_pct}
                changeLabel="1주"
              />
            ))}
          </Card>
          <p className="mt-3 px-2 text-xs text-muted-foreground">
            가격 열은 1개월 누적 수익률, 우측 변동률은 최근 1주 수익률입니다.
          </p>
        </TabsContent>

        <TabsContent value="commodities" className="mt-4">
          <Card className="divide-y divide-border/40 p-2">
            {commodities.map((c, i) => {
              const changePct = ((c.current - c.avg) / c.avg) * 100;
              return (
                <WatchlistRow
                  key={c.key}
                  rank={i + 1}
                  primary={c.label}
                  secondary={c.key.toUpperCase()}
                  price={c.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  changePct={changePct}
                  changeLabel="vs 6M avg"
                />
              );
            })}
          </Card>
        </TabsContent>

        <TabsContent value="stocks" className="mt-4">
          <Card className="divide-y divide-border/40 p-2">
            {stocks.map((s, i) => (
              <WatchlistRow
                key={s.ticker}
                rank={i + 1}
                primary={s.name}
                secondary={`${s.ticker} · ${s.sector}`}
                price={`$${s.price.toFixed(2)}`}
                changePct={s.changePct}
                changeLabel="전일 대비"
              />
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
