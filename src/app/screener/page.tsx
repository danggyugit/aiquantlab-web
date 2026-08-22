import { getFundamentals, getHeatmap, getStocksMeta, latestQuote } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Badge } from "@/components/ui/badge";
import { ScreenerClient, type ScreenerRow } from "./screener-client";

export const metadata = { title: "스크리너 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 8_Screener.py:
 *   1. Filter form (14 selectboxes/inputs, Apply/Reset)
 *   2. Sort by + Order (2 selectboxes)
 *   3. Results dataframe
 *   4. Sector Distribution bar chart
 */
export default async function ScreenerPage() {
  const [fund, stocks, heatmap] = await Promise.all([
    getFundamentals(),
    getStocksMeta(),
    getHeatmap(),
  ]);

  const rows: ScreenerRow[] = stocks
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

  const sectors = Array.from(new Set(rows.map((r) => r.sector))).filter(Boolean).sort();

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
          <span>Cached:</span>
          <Badge variant="secondary" className="text-[11px]">
            {rows.length.toLocaleString()} stocks
          </Badge>
          <span>Newest: {updatedAt} KST</span>
        </div>
      </header>

      <ScreenerClient rows={rows} sectors={sectors} />
    </div>
  );
}
