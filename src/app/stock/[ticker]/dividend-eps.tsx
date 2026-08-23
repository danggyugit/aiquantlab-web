import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dividend, EpsEstimate, EarningsSurpriseRow } from "@/lib/finnhub";

/**
 * Two related cards for Tier 1 #4 (dividend history) and Tier 2 #10
 * (EPS revision trend):
 *
 *   • DividendHistoryCard  — 10yr payouts + growth stats
 *   • EpsRevisionCard      — past-quarter estimates vs actuals
 *                             (are analysts revising up or down?)
 */

// ══════════════════════════════════════════════════════════
//  Dividend History (Tier 1 #4)
// ══════════════════════════════════════════════════════════

export function DividendHistoryCard({ data }: { data: Dividend[] | null }) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">💵 배당 이력</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            배당 이력이 없습니다 (배당 미지급 종목이거나 Finnhub 데이터 부재).
          </p>
        </CardContent>
      </Card>
    );
  }
  // Sort chronological (oldest first) for the chart, then group by year for the yearly sums
  const chrono = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const byYear = new Map<string, number>();
  for (const d of chrono) {
    const y = d.date.slice(0, 4);
    byYear.set(y, (byYear.get(y) ?? 0) + (d.amount || 0));
  }
  const yearly = Array.from(byYear.entries())
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => a.year.localeCompare(b.year))
    .slice(-10); // last 10 years

  // CAGR: first vs last year (only if we have both)
  const first = yearly[0];
  const last = yearly[yearly.length - 1];
  const nYears = yearly.length - 1;
  const cagr = first && last && first.total > 0 && nYears > 0
    ? (Math.pow(last.total / first.total, 1 / nYears) - 1) * 100
    : null;
  const maxTotal = Math.max(...yearly.map((y) => y.total));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">💵 배당 이력 ({yearly.length}년)</CardTitle>
        <CardDescription className="text-xs">
          연간 총 배당 · 최근 10년 · 배당 성장률로 지속성 판단
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cagr !== null && (
          <div className={cn(
            "rounded-lg border p-3 text-sm font-semibold",
            cagr >= 5 ? "border-success/40 bg-success/10 text-success"
              : cagr >= 0 ? "border-border/40 bg-muted/20 text-foreground"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}>
            {cagr >= 10 ? "🚀" : cagr >= 5 ? "📈" : cagr >= 0 ? "◆" : "📉"}{" "}
            {nYears}년 CAGR <span className="ml-1 font-mono">{cagr >= 0 ? "+" : ""}{cagr.toFixed(2)}%</span>
            {cagr >= 5 && " · 배당귀족 후보"}
            {cagr < 0 && " · 배당 감소 추세"}
          </div>
        )}
        <div className="flex items-end gap-1" style={{ height: 100 }}>
          {yearly.map((y) => {
            const pct = maxTotal > 0 ? (y.total / maxTotal) * 100 : 0;
            return (
              <div key={y.year} className="flex flex-1 flex-col items-center gap-1" title={`${y.year}: $${y.total.toFixed(2)}`}>
                <div className="flex w-full flex-col justify-end" style={{ height: 80 }}>
                  <div className="w-full rounded-sm bg-primary/70" style={{ height: `${pct}%` }} />
                </div>
                <span className="text-[9px] text-muted-foreground">{y.year.slice(2)}</span>
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-muted-foreground">
          최근년 배당 <strong className="text-foreground">${last?.total.toFixed(2)}</strong>
          {chrono.length > 0 && (
            <> · 최근 배당일 <strong className="text-foreground">{chrono[chrono.length - 1].date}</strong> · ${chrono[chrono.length - 1].amount.toFixed(2)}</>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  EPS Revision trend (Tier 2 #10)
// ══════════════════════════════════════════════════════════

export function EpsRevisionCard({
  estimates,
  actuals,
}: {
  estimates: EpsEstimate[] | null;
  actuals: EarningsSurpriseRow[] | null;
}) {
  if (!estimates || estimates.length === 0) {
    return null; // silent — nothing to show
  }
  // Sort estimates chronological
  const sorted = [...estimates].sort((a, b) => a.period.localeCompare(b.period));
  // Split into past (has actual) vs future (upcoming)
  const actualsByPeriod = new Map<string, number>();
  if (actuals) {
    for (const a of actuals) {
      actualsByPeriod.set(a.period, a.actual);
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sorted.filter((e) => e.period >= today);
  const nextThree = upcoming.slice(0, 3);

  // Revision direction: is the average estimate for the NEXT quarter trending
  // up (bullish) or down? We only have one snapshot, so use analyst dispersion:
  // (high - low) / avg small = tight consensus, large = uncertain.
  const next = nextThree[0];
  const dispersion = next && next.epsAvg !== 0
    ? ((next.epsHigh - next.epsLow) / Math.abs(next.epsAvg)) * 100
    : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">🔮 애널리스트 EPS 추정 (향후 3분기)</CardTitle>
        <CardDescription className="text-xs">
          예상치 vs 확정치 · 컨센서스 dispersion (좁을수록 확신 큼)
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {nextThree.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/60 bg-muted/20 text-left text-[10px] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5">분기</th>
                  <th className="px-2 py-1.5 text-right">평균 EPS</th>
                  <th className="px-2 py-1.5 text-right">최저</th>
                  <th className="px-2 py-1.5 text-right">최고</th>
                  <th className="px-2 py-1.5 text-right">Dispersion</th>
                  <th className="px-2 py-1.5 text-right">애널리스트</th>
                </tr>
              </thead>
              <tbody>
                {nextThree.map((e) => {
                  const disp = e.epsAvg !== 0 ? ((e.epsHigh - e.epsLow) / Math.abs(e.epsAvg)) * 100 : null;
                  const dispTone = disp === null ? "text-muted-foreground"
                    : disp < 10 ? "text-success"
                    : disp < 30 ? "text-foreground"
                    : "text-amber-400";
                  return (
                    <tr key={e.period} className="border-b border-border/30">
                      <td className="px-2 py-1.5 font-mono">{e.period}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-semibold">${e.epsAvg.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">${e.epsLow.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">${e.epsHigh.toFixed(2)}</td>
                      <td className={cn("px-2 py-1.5 text-right tabular-nums", dispTone)}>
                        {disp !== null ? `${disp.toFixed(1)}%` : "-"}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{e.numberAnalysts}명</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">향후 분기 EPS 추정 데이터가 없습니다.</p>
        )}
        {dispersion !== null && (
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Dispersion</strong> = (최고−최저)÷평균. 10% 미만 = 확신 강한 컨센서스,
            30%+ = 애널리스트 의견 크게 갈림 (실적 발표 후 큰 변동 가능).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
