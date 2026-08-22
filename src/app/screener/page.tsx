import {
  distanceFromHigh,
  getFundamentals,
  getHeatmap,
  getStocksMeta,
  latestQuote,
  periodReturn,
} from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreenerClient, type ScreenerRow } from "./screener-client";
import { RsClient, type RsRow } from "../rs-screener/rs-client";
import { BreakoutClient, type BreakoutRow } from "../breakout-screener/breakout-client";

export const metadata = { title: "스크리너 · AI Quant Lab" };
export const revalidate = 900;

function upDays(prices: { close: number }[]): number {
  let n = 0;
  for (let i = 1; i < prices.length; i++) if (prices[i].close > prices[i - 1].close) n++;
  return n;
}

/**
 * Unified screener — 3 tabs (Fundamental · RS · Breakout).
 * Reuses the individual clients from the original per-page implementations.
 */
export default async function ScreenerPage() {
  const [fund, stocks, heatmap] = await Promise.all([
    getFundamentals(),
    getStocksMeta(),
    getHeatmap(),
  ]);
  const stocksMap = new Map(stocks.map((s) => [s.ticker, s]));

  // ── Fundamental rows ──────────────────────────────────────────────
  const fundamentalRows: ScreenerRow[] = stocks
    .map((s) => {
      const f = fund.tickers[s.ticker];
      if (!f) return null;
      const priceData = heatmap.tickers[s.ticker];
      const q = priceData ? latestQuote(priceData) : null;
      const marketCap = priceData?.market_cap ?? 0;
      return {
        ticker: s.ticker,
        name: s.name,
        sector: s.sector,
        industry: s.industry,
        cap_tier: s.cap_tier,
        price: q?.price ?? null,
        market_cap: marketCap,
        pe_ratio: f.pe_ratio,
        pb_ratio: f.pb_ratio,
        ps_ratio: f.ps_ratio,
        eps: f.eps,
        roe: f.roe,
        dividend_yield: f.dividend_yield,
        beta: f.beta,
        debt_to_equity: f.debt_to_equity,
        avg_volume: f.avg_volume,
      } satisfies ScreenerRow;
    })
    .filter((r): r is ScreenerRow => r !== null);

  // ── RS rows (percentile rank of short-term return) ────────────────
  const rsRaw = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const meta = stocksMap.get(ticker);
      const q = latestQuote(data);
      const ret = periodReturn(data);
      if (!meta || !q || ret === null) return null;
      return { ticker, name: data.name, sector: data.sector, capTier: meta.cap_tier, ret };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const rsSorted = [...rsRaw].sort((a, b) => a.ret - b.ret);
  const rsTotal = rsSorted.length;
  const rsRankMap = new Map<string, number>();
  rsSorted.forEach((r, i) => rsRankMap.set(r.ticker, Math.round(((i + 1) / rsTotal) * 99)));
  const rsRows: RsRow[] = rsRaw.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    capTier: r.capTier,
    ret1m: r.ret,
    ret3m: r.ret,
    ret12m: r.ret,
    rsRating: rsRankMap.get(r.ticker) ?? 50,
  }));

  // ── Breakout rows ─────────────────────────────────────────────────
  const breakoutRows: BreakoutRow[] = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const meta = stocksMap.get(ticker);
      const f = fund.tickers[ticker];
      const q = latestQuote(data);
      if (!meta || !f?.fifty_two_week_high || !q) return null;
      const dist = distanceFromHigh(q.price, f.fifty_two_week_high);
      if (dist === null) return null;
      const ups = upDays(data.prices);
      const totalDays = data.prices.length - 1;
      const lastVol = data.prices[data.prices.length - 1]?.volume ?? 0;
      const volRatio = f.avg_volume && f.avg_volume > 0 ? lastVol / f.avg_volume : 1;
      return {
        ticker,
        name: data.name,
        sector: data.sector,
        capTier: meta.cap_tier,
        marketCap: data.market_cap,
        price: q.price,
        fiftyTwoWkHigh: f.fifty_two_week_high,
        distFromHigh: dist,
        changePct: q.changePct,
        upDays: ups,
        totalDays,
        volumeRatio: volRatio,
      } satisfies BreakoutRow;
    })
    .filter((x): x is BreakoutRow => x !== null);

  const sectorsFund = Array.from(new Set(fundamentalRows.map((r) => r.sector))).filter(Boolean).sort();
  const sectorsRs = Array.from(new Set(rsRows.map((r) => r.sector))).filter(Boolean).sort();
  const sectorsBrk = Array.from(new Set(breakoutRows.map((r) => r.sector))).filter(Boolean).sort();

  const updatedAt = new Date(fund.updated_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">스크리너</h1>
          <MarketBadge />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-[11px]">
            펀더멘털 {fundamentalRows.length.toLocaleString()} · RS {rsRows.length.toLocaleString()} · 돌파 {breakoutRows.length.toLocaleString()}
          </Badge>
          <span>Newest: {updatedAt} KST</span>
        </div>
      </header>

      <Tabs defaultValue="fundamental">
        <TabsList className="flex flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger value="fundamental" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            📊 펀더멘털
          </TabsTrigger>
          <TabsTrigger value="rs" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            🚀 RS 모멘텀
          </TabsTrigger>
          <TabsTrigger value="breakout" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            📈 돌파
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fundamental" className="mt-4">
          <ScreenerClient rows={fundamentalRows} sectors={sectorsFund} />
        </TabsContent>

        <TabsContent value="rs" className="mt-4">
          <RsClient rows={rsRows} sectors={sectorsRs} />
        </TabsContent>

        <TabsContent value="breakout" className="mt-4">
          <BreakoutClient rows={breakoutRows} sectors={sectorsBrk} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
