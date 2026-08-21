import Link from "next/link";
import { getHeatmap, periodReturn, latestQuote, fmtMarketCap } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "RS 스크리너 · AI Quant Lab" };
export const revalidate = 900;

export default async function RsScreenerPage() {
  const heatmap = await getHeatmap();

  // Compute period return (short-term momentum), then percentile-rank across universe.
  const universe = Object.entries(heatmap.tickers)
    .map(([ticker, d]) => {
      const ret = periodReturn(d);
      const q = latestQuote(d);
      if (ret === null || !q) return null;
      return { ticker, name: d.name, sector: d.sector, marketCap: d.market_cap, ret, price: q.price };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Percentile rank (0-99)
  const sorted = [...universe].sort((a, b) => a.ret - b.ret);
  const total = sorted.length;
  const withRank = universe.map((u) => {
    const idx = sorted.findIndex((s) => s.ticker === u.ticker);
    const percentile = Math.round(((idx + 1) / total) * 99);
    return { ...u, rank: percentile };
  });

  const topRs = [...withRank].sort((a, b) => b.rank - a.rank).slice(0, 50);
  const bottomRs = [...withRank].sort((a, b) => a.rank - b.rank).slice(0, 20);

  // Sector distribution of top 50
  const sectorCounts = new Map<string, number>();
  for (const r of topRs) sectorCounts.set(r.sector, (sectorCounts.get(r.sector) ?? 0) + 1);
  const sectorDist = Array.from(sectorCounts.entries())
    .map(([s, n]) => ({ sector: s, n }))
    .sort((a, b) => b.n - a.n);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">RS 스크리너</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          단기 모멘텀 백분위 랭킹 (RS Rating 근사)
        </p>
      </header>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
        <strong className="text-amber-400">데이터 한계:</strong> 표준 IBD RS는 12개월 성과 기반이나,
        현재 캐시는 최근 5거래일만 저장 → <strong>단기 모멘텀 근사치</strong>. 추후 12M 히스토리 캐시 추가 후
        정식 지표로 대체 예정.
      </div>

      {/* Sector distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 50 섹터 분포</CardTitle>
          <CardDescription className="text-xs">모멘텀 상위 50 종목의 섹터 비중</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {sectorDist.map((s) => (
              <div key={s.sector} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs">{s.sector}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(s.n / 50) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{s.n}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top 50 */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Top 50 모멘텀 종목</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">회사</th>
                <th className="hidden px-3 py-2 sm:table-cell">섹터</th>
                <th className="px-3 py-2 text-right">현재가</th>
                <th className="px-3 py-2 text-right">기간 수익률</th>
                <th className="px-3 py-2 text-right">RS Rank</th>
              </tr>
            </thead>
            <tbody>
              {topRs.map((r, i) => (
                <tr key={r.ticker} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                    <Link href={`/stock/${r.ticker}`} className="text-primary hover:underline">
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2">{r.name}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{r.sector}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${r.price.toFixed(2)}</td>
                  <td className={cn(
                    "px-3 py-2 text-right tabular-nums font-semibold",
                    r.ret >= 0 ? "text-success" : "text-destructive",
                  )}>
                    {r.ret >= 0 ? "+" : ""}
                    {r.ret.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "tabular-nums",
                        r.rank >= 90 ? "bg-success/20 text-success" : "bg-primary/15 text-primary",
                      )}
                    >
                      {r.rank}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Bottom 20 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bottom 20 (모멘텀 하위)</CardTitle>
          <CardDescription className="text-xs">약세 종목 참고용</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {bottomRs.map((r) => (
              <Link
                key={r.ticker}
                href={`/stock/${r.ticker}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-xs font-mono font-semibold hover:bg-destructive/20"
              >
                {r.ticker}
                <span className="font-normal text-muted-foreground">{r.ret.toFixed(1)}%</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Universe: {total.toLocaleString()} 종목 · 총 시가총액 {fmtMarketCap(universe.reduce((a, b) => a + b.marketCap, 0))}
      </p>
    </div>
  );
}
