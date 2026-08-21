import { getHeatmap, latestQuote } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { PortfolioClient } from "./portfolio-client";

export const metadata = { title: "포트폴리오 · AI Quant Lab" };
export const revalidate = 900;

export default async function PortfolioPage() {
  const heatmap = await getHeatmap();

  // Ticker → latest close price, injected into client so calculations
  // stay on the browser (localStorage-only, no server round-trips).
  const quotes: Record<string, number> = {};
  for (const [ticker, data] of Object.entries(heatmap.tickers)) {
    const q = latestQuote(data);
    if (q) quotes[ticker] = q.price;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">포트폴리오</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          로컬 거래 기록 기반 포트폴리오 관리 · S&amp;P500 종목만 실시간 평가 지원
        </p>
      </header>
      <PortfolioClient quotes={quotes} />
    </div>
  );
}
