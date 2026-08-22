import { Suspense } from "react";
import { getHeatmap, getFundamentals, latestQuote, fmtMarketCap } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { CompareClient, type CompareTickerData } from "./compare-client";

export const metadata = { title: "종목 비교 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 9_Compare.py (257 lines):
 *   1. Input Controls (ticker text + period selector)
 *   2. Overview Cards (per-ticker: logo + price + change)
 *   3. Normalized Performance (multi-line, start=100)
 *   4. Returns Bar Chart
 *   5. Fundamentals Table (PE/PB/EPS/ROE/DivYield/Beta/52W)
 *   6. Visual Profile (radar chart on normalized metrics)
 */
export default async function ComparePage() {
  const [heatmap, fund] = await Promise.all([getHeatmap(), getFundamentals()]);

  const data: CompareTickerData[] = Object.entries(heatmap.tickers)
    .filter(([, d]) => d.prices && d.prices.length > 0)
    .map(([ticker, d]) => {
      const q = latestQuote(d);
      const f = fund.tickers[ticker];
      return {
        ticker,
        name: d.name,
        sector: d.sector,
        marketCap: fmtMarketCap(d.market_cap),
        currentPrice: q?.price ?? null,
        changePct: q?.changePct ?? null,
        prices: d.prices.map((p) => ({ date: p.date.slice(5), close: p.close })),
        fundamentals: f
          ? {
              pe: f.pe_ratio,
              pb: f.pb_ratio,
              eps: f.eps,
              roe: f.roe,
              divYield: f.dividend_yield,
              beta: f.beta,
              hi52: f.fifty_two_week_high,
              lo52: f.fifty_two_week_low,
            }
          : null,
      };
    });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">종목 비교</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          최대 5개 종목 · Streamlit 9_Compare.py 미러링 (성과 · 펀더멘털 · 레이더)
        </p>
      </header>

      <Suspense fallback={<div className="text-sm text-muted-foreground">로딩 중...</div>}>
        <CompareClient allTickers={data} />
      </Suspense>
    </div>
  );
}
