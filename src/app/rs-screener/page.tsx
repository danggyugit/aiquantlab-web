import { getHeatmap, getStocksMeta, latestQuote, periodReturn } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Badge } from "@/components/ui/badge";
import { RsClient, type RsRow } from "./rs-client";

export const metadata = { title: "RS 스크리너 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 14_RS_Screener.py:
 *   Hero + filters (sector / cap / min RS slider)
 *   RS distribution histogram
 *   Summary metrics (scanned / filtered / RS90+ / RS80+ / avg RS)
 *   RS 90+ chip row (highlights)
 *   Result table (rank, ticker, name, sector, RS, 1M/3M/12M returns)
 *
 * Cache limits: real IBD RS uses 12M weighted returns. Ours uses the
 * available 5-day window and percentile-ranks it — noted in the UI.
 */
export default async function RsScreenerPage() {
  const [heatmap, stocks] = await Promise.all([getHeatmap(), getStocksMeta()]);
  const stocksMap = new Map(stocks.map((s) => [s.ticker, s]));

  // Compute short-term momentum for each ticker
  const raw = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const meta = stocksMap.get(ticker);
      const q = latestQuote(data);
      const ret = periodReturn(data);
      if (!meta || !q || ret === null) return null;
      return {
        ticker,
        name: data.name,
        sector: data.sector,
        capTier: meta.cap_tier,
        ret: ret,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Percentile-rank across the universe → RS 1-99
  const sorted = [...raw].sort((a, b) => a.ret - b.ret);
  const total = sorted.length;
  const rankMap = new Map<string, number>();
  sorted.forEach((r, i) => rankMap.set(r.ticker, Math.round(((i + 1) / total) * 99)));

  const rows: RsRow[] = raw.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    sector: r.sector,
    capTier: r.capTier,
    ret1m: r.ret,    // Short-term proxy for 1M
    ret3m: r.ret,    // Same (cache limit)
    ret12m: r.ret,   // Same (cache limit)
    rsRating: rankMap.get(r.ticker) ?? 50,
  }));

  const sectors = Array.from(new Set(rows.map((r) => r.sector))).filter(Boolean).sort();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-transparent to-transparent p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">RS 스크리너</h1>
          <MarketBadge />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          상대 강도 백분위 랭킹 · Streamlit 14_RS_Screener.py 미러링
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">IBD RS Rating 근사</Badge>
          <Badge variant="secondary" className="text-[10px]">Universe: {rows.length.toLocaleString()}</Badge>
          <Badge variant="secondary" className="text-[10px]">Percentile 1-99</Badge>
        </div>
      </div>

      <RsClient rows={rows} sectors={sectors} />
    </div>
  );
}
