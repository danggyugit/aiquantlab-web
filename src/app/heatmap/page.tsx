import { getHeatmap, getMarketSnapshot, latestQuote } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { SectorStrip } from "@/components/sector-strip";
import { HeatmapTreemap } from "@/components/heatmap-treemap";

export const metadata = {
  title: "히트맵 · AI Quant Lab",
};

export default async function HeatmapPage() {
  const [snapshot, heatmap] = await Promise.all([getMarketSnapshot(), getHeatmap()]);

  // Top 60 by market cap, with computed daily change from the last two closes.
  const nodes = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const q = latestQuote(data);
      if (!q) return null;
      return {
        name: ticker,
        fullName: data.name,
        sector: data.sector,
        size: data.market_cap,
        changePct: q.changePct,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.size - a.size)
    .slice(0, 60);

  const updatedAt = new Date(heatmap.updated_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">히트맵</h1>
          <MarketBadge />
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {updatedAt} KST · Box size = 시가총액, 색상 = 전일 대비 등락
        </p>
      </header>

      <section aria-labelledby="sector-section">
        <h2 id="sector-section" className="mb-2 text-lg font-semibold">
          섹터 성과 (1주 · 1개월)
        </h2>
        <SectorStrip sectors={snapshot.sectors} />
      </section>

      <section aria-labelledby="heatmap-section">
        <h2 id="heatmap-section" className="mb-2 text-lg font-semibold">
          시가총액 상위 60 종목
        </h2>
        <HeatmapTreemap data={nodes} />
      </section>
    </div>
  );
}
