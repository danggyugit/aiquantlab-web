import { getFundamentals, getHeatmap, getStocksMeta, latestQuote, distanceFromHigh } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Badge } from "@/components/ui/badge";
import { BreakoutClient, type BreakoutRow } from "./breakout-client";

export const metadata = { title: "돌파 스크리너 · AI Quant Lab" };
export const revalidate = 900;

function upDays(prices: { close: number }[]): number {
  let n = 0;
  for (let i = 1; i < prices.length; i++) if (prices[i].close > prices[i - 1].close) n++;
  return n;
}

/**
 * Mirrors Streamlit 17_Breakout_Screener.py:
 *   Hero → Channel settings (3 sliders) → Filters (trend/R²/toggle/sector/cap)
 *   → Result table (11 cols)
 *   → Notes expander
 *
 * Streamlit uses monthly-bar regression channels (log-price + kσ bands).
 * Cache limit: only 5-day daily bars → approximate with 52W high proximity
 * and up-day ratio. Notes expander explains the limitation.
 */
export default async function BreakoutScreenerPage() {
  const [heatmap, fund, stocks] = await Promise.all([
    getHeatmap(),
    getFundamentals(),
    getStocksMeta(),
  ]);
  const stocksMap = new Map(stocks.map((s) => [s.ticker, s]));

  const rows: BreakoutRow[] = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const meta = stocksMap.get(ticker);
      const f = fund.tickers[ticker];
      const q = latestQuote(data);
      if (!meta || !f?.fifty_two_week_high || !q) return null;
      const dist = distanceFromHigh(q.price, f.fifty_two_week_high);
      if (dist === null) return null;
      const ups = upDays(data.prices);
      const totalDays = data.prices.length - 1;
      const lastVol = data.prices[data.prices.length - 1]?.volume ?? 0;
      const volRatio = f.avg_volume && f.avg_volume > 0 ? lastVol / f.avg_volume : 1;
      return {
        ticker,
        name: data.name,
        sector: data.sector,
        capTier: meta.cap_tier,
        marketCap: data.market_cap,
        price: q.price,
        fiftyTwoWkHigh: f.fifty_two_week_high,
        distFromHigh: dist,
        changePct: q.changePct,
        upDays: ups,
        totalDays,
        volumeRatio: volRatio,
      };
    })
    .filter((x): x is BreakoutRow => x !== null);

  const sectors = Array.from(new Set(rows.map((r) => r.sector))).filter(Boolean).sort();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-transparent to-transparent p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">돌파 스크리너</h1>
          <MarketBadge />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          월봉 추세채널 돌파 종목 스캔 · Streamlit 17_Breakout_Screener.py 미러링
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">로그 회귀 + kσ 채널</Badge>
          <Badge variant="secondary" className="text-[10px]">Universe: {rows.length.toLocaleString()}</Badge>
          <Badge variant="secondary" className="text-[10px]">캐시 근사 버전</Badge>
        </div>
      </div>

      <BreakoutClient rows={rows} sectors={sectors} />
    </div>
  );
}
