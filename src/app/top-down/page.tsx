import { Compass } from "lucide-react";
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
import { TopDownWorkflow, type TickerRow } from "./workflow";

export const metadata = { title: "Top-Down Analysis · AI Quant Lab" };
export const revalidate = 900;

/**
 * Top-Down Analysis workflow — guides through 5 filter layers so a user
 * doesn't buy a strong stock inside a weak sector inside a weak market.
 *
 *   1. Market Regime   (Go/No-Go verdict from SPY vs 200MA · VIX · Breadth · F&G)
 *   2. Sector RS       (11 SPDR ETFs · 3M excess-vs-SPY · select one)
 *   3. Industry        (drill-down within the selected sector)
 *   4. Stock RS        (constituents of the selected industry · Pattern column)
 *   5. Price Structure (52W position · trend acceleration · volume)
 *
 * Every layer feeds the next via user selection so the final short-list
 * carries the whole macro-to-micro thesis.
 */

export default async function TopDownPage() {
  const [snapshot, heatmap, stocks, fund] = await Promise.all([
    getMarketSnapshot(),
    getHeatmap(),
    getStocksMeta(),
    getFundamentals(),
  ]);

  // Ticker rows — one flat array; the client component drills by sector/industry.
  const stocksMap = new Map(stocks.map((s) => [s.ticker, s]));
  const rows: TickerRow[] = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const meta = stocksMap.get(ticker);
      const f = fund.tickers[ticker];
      const q = latestQuote(data);
      if (!meta || !data.returns || !data.market_cap) return null;
      // Recent 5-day up-day ratio for the "recent flow" cue in Step 5
      let upDays = 0;
      for (let i = 1; i < data.prices.length; i++) {
        if (data.prices[i].close > data.prices[i - 1].close) upDays += 1;
      }
      const totalDays = Math.max(1, data.prices.length - 1);

      return {
        ticker,
        name: data.name,
        sector: data.sector,
        industry: (meta.industry as string | null | undefined) ?? null,
        capTier: meta.cap_tier,
        marketCap: data.market_cap,
        price: q?.price ?? null,
        changePct: q?.changePct ?? null,
        returns: data.returns as Record<string, number | null | undefined>,
        fiftyTwoWkHigh: f?.fifty_two_week_high ?? null,
        fiftyTwoWkLow: f?.fifty_two_week_low ?? null,
        distFromHigh: q && f?.fifty_two_week_high ? distanceFromHigh(q.price, f.fifty_two_week_high) : null,
        upDaysRatio: upDays / totalDays,     // 0..1
        avgVolume: f?.avg_volume ?? null,
        lastVolume: data.prices[data.prices.length - 1]?.volume ?? 0,
      } satisfies TickerRow;
    })
    .filter((r): r is TickerRow => r !== null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-transparent to-transparent p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5">
            <Compass className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Top-Down 분석</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              시장 → 섹터 → 산업 → 종목 → 진입시점 · 5단계 순차 필터로 최고 후보 도출
            </p>
          </div>
          <MarketBadge />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">CANSLIM 스타일</Badge>
          <Badge variant="secondary" className="text-[10px]">Weinstein Stage</Badge>
          <Badge variant="secondary" className="text-[10px]">Minervini SEPA</Badge>
        </div>
      </div>

      <TopDownWorkflow snapshot={snapshot} rows={rows} />
    </div>
  );
}
