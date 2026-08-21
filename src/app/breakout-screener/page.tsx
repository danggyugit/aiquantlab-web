import Link from "next/link";
import { getHeatmap, getFundamentals, latestQuote, distanceFromHigh, fmtMarketCap } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

export const metadata = { title: "돌파 스크리너 · AI Quant Lab" };
export const revalidate = 900;

/** Rough breakout score: high-proximity + up-day count in the price series. */
function upDays(prices: { close: number }[]): number {
  let n = 0;
  for (let i = 1; i < prices.length; i++) {
    if (prices[i].close > prices[i - 1].close) n++;
  }
  return n;
}

export default async function BreakoutScreenerPage() {
  const [heatmap, fund] = await Promise.all([getHeatmap(), getFundamentals()]);

  const rows = Object.entries(heatmap.tickers)
    .map(([ticker, d]) => {
      const q = latestQuote(d);
      const f = fund.tickers[ticker];
      if (!q || !f?.fifty_two_week_high) return null;
      const dist = distanceFromHigh(q.price, f.fifty_two_week_high);
      if (dist === null) return null;
      const ups = upDays(d.prices);
      const totalDays = d.prices.length - 1;
      return {
        ticker,
        name: d.name,
        sector: d.sector,
        marketCap: d.market_cap,
        price: q.price,
        changePct: q.changePct,
        fiftyTwoWkHigh: f.fifty_two_week_high,
        distFromHigh: dist,
        upDays: ups,
        totalDays,
        volume: d.prices[d.prices.length - 1]?.volume ?? 0,
        avgVolume: f.avg_volume ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Near 52-week high (within 3%)
  const nearHigh = rows
    .filter((r) => r.distFromHigh >= -3 && r.distFromHigh <= 1)
    .sort((a, b) => b.distFromHigh - a.distFromHigh);

  // Fresh high (breaks above 52-week high)
  const freshHigh = rows.filter((r) => r.distFromHigh >= 0);

  // High volume breakouts (near high + volume > 1.5x avg)
  const volBreakouts = nearHigh
    .filter((r) => r.avgVolume > 0 && r.volume > r.avgVolume * 1.5)
    .slice(0, 20);

  // Strong momentum (5/5 up days)
  const streaks = rows
    .filter((r) => r.totalDays > 0 && r.upDays === r.totalDays && r.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 20);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">돌파 스크리너</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          52주 고점 근접·돌파·모멘텀 강세 종목 스캔
        </p>
      </header>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
        <strong className="text-amber-400">데이터 한계:</strong> 원본 Streamlit의 <strong>월봉 회귀 채널</strong>은
        구현되지 않았음. 현재는 52주 고점 근접도 · 최근 상승일 연속 · 거래량 급증으로 근사 판정.
        월봉 캐시 추가 시 정식 스크리너로 대체.
      </div>

      {/* Summary counts */}
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryTile label="52주 신고가 돌파" value={freshHigh.length} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <SummaryTile label="고점 근접 (±3%)" value={nearHigh.length} tone="primary" />
        <SummaryTile label="거래량 급증 돌파" value={volBreakouts.length} tone="premium" />
        <SummaryTile label="연속 상승 (5/5)" value={streaks.length} tone="success" />
      </div>

      {/* Fresh high */}
      {freshHigh.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">52주 신고가 돌파 종목</CardTitle>
            <CardDescription className="text-xs">
              직전 52주 고점 대비 현재가가 같거나 높음
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StockGrid rows={freshHigh} showDist />
          </CardContent>
        </Card>
      )}

      {/* Near high */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">52주 고점 근접 (Top 30)</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">회사</th>
                <th className="hidden px-3 py-2 sm:table-cell">섹터</th>
                <th className="px-3 py-2 text-right">현재가</th>
                <th className="px-3 py-2 text-right">52주 고점</th>
                <th className="px-3 py-2 text-right">고점 대비</th>
                <th className="px-3 py-2 text-right">시가총액</th>
              </tr>
            </thead>
            <tbody>
              {nearHigh.slice(0, 30).map((r) => (
                <tr key={r.ticker} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                    <Link href={`/stock/${r.ticker}`} className="text-primary hover:underline">{r.ticker}</Link>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2">{r.name}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{r.sector}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${r.price.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${r.fiftyTwoWkHigh.toFixed(2)}</td>
                  <td className={cn(
                    "px-3 py-2 text-right tabular-nums font-semibold",
                    r.distFromHigh >= 0 ? "text-success" : "text-amber-400",
                  )}>
                    {r.distFromHigh >= 0 ? "+" : ""}{r.distFromHigh.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {fmtMarketCap(r.marketCap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Volume breakouts + streaks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">거래량 급증 돌파</CardTitle>
            <CardDescription className="text-xs">고점 근접 + 최근 거래량 &gt; 평균 1.5×</CardDescription>
          </CardHeader>
          <CardContent>
            {volBreakouts.length > 0 ? (
              <StockGrid rows={volBreakouts} showDist />
            ) : (
              <p className="text-xs text-muted-foreground">해당 종목 없음</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">연속 상승 종목 (5/5)</CardTitle>
            <CardDescription className="text-xs">캐시 기간 내 모든 거래일 상승</CardDescription>
          </CardHeader>
          <CardContent>
            {streaks.length > 0 ? (
              <StockGrid rows={streaks} showChange />
            ) : (
              <p className="text-xs text-muted-foreground">해당 종목 없음</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type Row = {
  ticker: string;
  name: string;
  distFromHigh?: number;
  changePct?: number;
};

function StockGrid({ rows, showDist, showChange }: { rows: Row[]; showDist?: boolean; showChange?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((r) => (
        <Link
          key={r.ticker}
          href={`/stock/${r.ticker}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-xs font-mono font-semibold hover:bg-primary/20"
          title={r.name}
        >
          {r.ticker}
          {showDist && r.distFromHigh !== undefined && (
            <span className={cn("font-normal", r.distFromHigh >= 0 ? "text-success" : "text-muted-foreground")}>
              {r.distFromHigh >= 0 ? "+" : ""}{r.distFromHigh.toFixed(1)}%
            </span>
          )}
          {showChange && r.changePct !== undefined && (
            <span className="font-normal text-success">+{r.changePct.toFixed(1)}%</span>
          )}
        </Link>
      ))}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone: "success" | "primary" | "premium";
}) {
  const color =
    tone === "success" ? "text-success border-success/30 bg-success/5" :
    tone === "premium" ? "text-premium border-premium/30 bg-premium/5" :
    "text-primary border-primary/30 bg-primary/5";
  return (
    <Card className={cn("border", color)}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "success" ? "text-success" : tone === "premium" ? "text-premium" : "text-primary")}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
