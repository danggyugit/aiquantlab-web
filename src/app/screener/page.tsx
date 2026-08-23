import {
  distanceFromHigh,
  getFundamentals,
  getHeatmap,
  getMarketSnapshot,
  getStocksMeta,
  latestQuote,
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
  const [fund, stocks, heatmap, snapshot] = await Promise.all([
    getFundamentals(),
    getStocksMeta(),
    getHeatmap(),
    getMarketSnapshot(),
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

  // ── RS rows: excess return vs SPY per period + 3M percentile ────
  // SPY baseline from market_snapshot (spy_returns per period).
  const spyRet = snapshot.spy_returns ?? {};
  const spy = {
    "1m":  typeof spyRet["1m"] === "number" ? spyRet["1m"] : 0,
    "3m":  typeof spyRet["3m"] === "number" ? spyRet["3m"] : 0,
    "6m":  typeof spyRet["6m"] === "number" ? spyRet["6m"] : 0,
    "1y":  typeof spyRet["1y"] === "number" ? spyRet["1y"] : 0,
  };

  // Derive 12-1M raw return from 12M and 1M returns (compounding identity):
  //   (1 + r_12m) / (1 + r_1m) - 1  ==  P[t-21] / P[t-252] - 1  (exact)
  // Same trick applied to SPY so we can also take excess-vs-SPY on 12-1M.
  function twelveMinusOne(r12m: number | null, r1m: number | null): number | null {
    if (r12m === null || r1m === null) return null;
    const denom = 1 + r1m / 100;
    if (denom === 0) return null;
    return ((1 + r12m / 100) / denom - 1) * 100;
  }
  const spy12_1m = twelveMinusOne(spy["1y"], spy["1m"]) ?? 0;

  const rsRaw = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const meta = stocksMap.get(ticker);
      if (!meta || !data.returns) return null;
      const r = data.returns;
      const excess = (period: "1m" | "3m" | "6m" | "1y") => {
        const v = r[period];
        return typeof v === "number" ? v - spy[period] : null;
      };
      const r1m = typeof r["1m"] === "number" ? r["1m"] : null;
      const r12m = typeof r["1y"] === "number" ? r["1y"] : null;
      const stock12_1m = twelveMinusOne(r12m, r1m);
      const ex12_1m = stock12_1m !== null ? stock12_1m - spy12_1m : null;
      return {
        ticker,
        name: data.name,
        sector: data.sector,
        capTier: meta.cap_tier,
        ex1m: excess("1m"),
        ex3m: excess("3m"),
        ex6m: excess("6m"),
        ex12m: excess("1y"),
        ex12_1m,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // RS Rating = percentile of 3M excess return across universe (only rows with valid ex3m)
  const rankable = rsRaw.filter((r) => r.ex3m !== null) as Array<typeof rsRaw[number] & { ex3m: number }>;
  rankable.sort((a, b) => a.ex3m - b.ex3m);
  const rsTotal = rankable.length;
  const rsRankMap = new Map<string, number>();
  rankable.forEach((r, i) => rsRankMap.set(r.ticker, Math.max(1, Math.round(((i + 1) / rsTotal) * 99))));
  const rsRows: RsRow[] = rsRaw.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    capTier: r.capTier,
    ex1m: r.ex1m,
    ex3m: r.ex3m,
    ex6m: r.ex6m,
    ex12m: r.ex12m,
    ex12_1m: r.ex12_1m,
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
