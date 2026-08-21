import { getStocksMeta } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { StockSearchClient } from "./search-client";

export const metadata = { title: "종목 상세 · AI Quant Lab" };
export const revalidate = 900;

export default async function StockIndexPage() {
  const stocks = await getStocksMeta();

  const compact = stocks.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">종목 상세</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          S&amp;P500 종목 검색 → 클릭 시 상세 페이지로 이동
        </p>
      </header>

      <StockSearchClient stocks={compact} />
    </div>
  );
}
