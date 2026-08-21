import { getHeatmap } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { CompareClient, type CompareTickerData } from "./compare-client";

export const metadata = { title: "종목 비교 · AI Quant Lab" };
export const revalidate = 900;

export default async function ComparePage() {
  const heatmap = await getHeatmap();

  const data: CompareTickerData[] = Object.entries(heatmap.tickers)
    .filter(([, d]) => d.prices && d.prices.length > 0)
    .map(([ticker, d]) => ({
      ticker,
      name: d.name,
      sector: d.sector,
      prices: d.prices.map((p) => ({ date: p.date.slice(5), close: p.close })),
    }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">종목 비교</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          최대 5개 종목 성과 정규화 비교 · 첫 거래일=100 기준
        </p>
      </header>

      <CompareClient allTickers={data} />
    </div>
  );
}
