import { getHeatmap, latestQuote } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { PortfolioClient } from "./portfolio-client";

export const metadata = { title: "포트폴리오 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 5_Portfolio.py 5-tab structure:
 *   보유(Holdings) · 거래(Trades) · 성과(Performance) · 배당(Dividends) · 세금(Tax)
 * Uses localStorage instead of Turso DB.
 */
export default async function PortfolioPage() {
  const heatmap = await getHeatmap();

  const quotes: Record<string, { price: number; sector: string }> = {};
  for (const [ticker, data] of Object.entries(heatmap.tickers)) {
    const q = latestQuote(data);
    if (q) quotes[ticker] = { price: q.price, sector: data.sector };
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">포트폴리오</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          5탭 (보유·거래·성과·배당·세금) · Streamlit 5_Portfolio.py 미러링 · localStorage 기반
        </p>
      </header>

      <PortfolioClient quotes={quotes} />
    </div>
  );
}
