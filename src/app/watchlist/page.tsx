import { getHeatmap, latestQuote } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { WatchlistClient } from "./watchlist-client";

export const metadata = { title: "관심목록 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 10_Watchlist.py:
 *   Tab 1: Watchlist (add form + card grid + remove)
 *   Tab 2: Alerts (create + active list + triggered list)
 *
 * Uses browser localStorage instead of Turso DB (Streamlit auth flow).
 * Alerts auto-check on page load against current quotes.
 */
export default async function WatchlistPage() {
  const heatmap = await getHeatmap();

  // Build quote map (ticker → price, changePct, name, sector) for the client
  const quotes: Record<string, { price: number; changePct: number; name: string; sector: string }> = {};
  for (const [ticker, data] of Object.entries(heatmap.tickers)) {
    const q = latestQuote(data);
    if (q) quotes[ticker] = { ...q, name: data.name, sector: data.sector };
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">관심목록</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          관심 종목 · 가격 알림 · Streamlit 10_Watchlist.py 미러링 (localStorage 기반)
        </p>
      </header>

      <WatchlistClient quotes={quotes} />
    </div>
  );
}
