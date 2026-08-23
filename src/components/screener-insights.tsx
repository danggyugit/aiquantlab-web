"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * "Where are the winners clustered?" card. Given the filtered results and
 * the full universe, it computes sector + industry distribution and shows
 * *concentration* (filtered share ÷ universe share). A sector at 40% of
 * results but 15% of universe = 2.7× overrepresented = active leadership.
 *
 * Reusable across all screener tabs (RS · 신고가 돌파 · 펀더멘털) — any row
 * type with `sector` and `industry` fields works.
 */

type MinimalRow = { sector: string; industry: string | null };

export function ScreenerInsights({
  filtered,
  universe,
  title = "🎯 필터 결과 분포",
  hint,
}: {
  filtered: MinimalRow[];
  universe: MinimalRow[];
  title?: string;
  hint?: string;
}) {
  const insights = useMemo(() => {
    if (filtered.length === 0) return null;

    // Sector breakdown
    const sectorFiltered = countBy(filtered, (r) => r.sector);
    const sectorUniverse = countBy(universe, (r) => r.sector);
    const sectors = Array.from(sectorFiltered.entries())
      .map(([name, count]) => {
        const univCount = sectorUniverse.get(name) ?? 0;
        const filteredPct = (count / filtered.length) * 100;
        const universePct = universe.length > 0 ? (univCount / universe.length) * 100 : 0;
        const concentration = universePct > 0 ? filteredPct / universePct : 0;
        return { name, count, filteredPct, universePct, concentration };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Industry breakdown (skip null industries)
    const withIndustry = filtered.filter((r) => r.industry);
    const industryFiltered = countBy(withIndustry, (r) => r.industry!);
    const industryUniverse = countBy(universe.filter((r) => r.industry), (r) => r.industry!);
    const industries = Array.from(industryFiltered.entries())
      .map(([name, count]) => {
        const univCount = industryUniverse.get(name) ?? 0;
        const filteredPct = (count / withIndustry.length) * 100;
        const universePct = universe.length > 0 ? (univCount / universe.length) * 100 : 0;
        const concentration = universePct > 0 ? filteredPct / universePct : 0;
        return { name, count, filteredPct, universePct, concentration };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Insight line: top 3 industries' share
    const top3IndustryShare = industries.slice(0, 3).reduce((s, x) => s + x.filteredPct, 0);
    const topIndustryNames = industries.slice(0, 3).map((x) => x.name).join(" · ");

    return { sectors, industries, top3IndustryShare, topIndustryNames };
  }, [filtered, universe]);

  if (!insights || filtered.length === 0) return null;

  const maxSectorCount = Math.max(...insights.sectors.map((s) => s.count));
  const maxIndustryCount = insights.industries.length > 0
    ? Math.max(...insights.industries.map((s) => s.count))
    : 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-xs">
          {hint ?? `필터 통과 ${filtered.length.toLocaleString()}종목 · 유니버스 ${universe.length.toLocaleString()}종목 대비 집중도`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Sector Top 6 */}
        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <span className="font-semibold">섹터 (Top 6)</span>
            <span className="text-muted-foreground">필터% · 집중도 (× 유니버스%)</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {insights.sectors.map((s) => (
              <BreakdownRow
                key={s.name}
                name={s.name}
                count={s.count}
                barPct={(s.count / maxSectorCount) * 100}
                filteredPct={s.filteredPct}
                concentration={s.concentration}
              />
            ))}
          </div>
        </div>

        {/* Industry Top 8 */}
        {insights.industries.length > 0 && (
          <div>
            <div className="mb-2 flex items-baseline justify-between text-xs">
              <span className="font-semibold">산업 (Top 8)</span>
              <span className="text-muted-foreground">필터% · 집중도 (× 유니버스%)</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {insights.industries.map((s) => (
                <BreakdownRow
                  key={s.name}
                  name={s.name}
                  count={s.count}
                  barPct={(s.count / maxIndustryCount) * 100}
                  filteredPct={s.filteredPct}
                  concentration={s.concentration}
                />
              ))}
            </div>
          </div>
        )}

        {/* Takeaway */}
        {insights.industries.length >= 3 && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
            <div className="font-semibold text-primary">💡 인사이트</div>
            <p className="mt-1 text-muted-foreground">
              상위 3개 산업 (<strong className="text-foreground">{insights.topIndustryNames}</strong>)이
              필터 결과의 <strong className="text-foreground">{insights.top3IndustryShare.toFixed(0)}%</strong>를 차지합니다.
              {insights.industries[0].concentration >= 2 && (
                <> 특히 <strong className="text-success">{insights.industries[0].name}</strong>는 유니버스 대비 <strong className="text-success">{insights.industries[0].concentration.toFixed(1)}배</strong> 집중 — 강한 주도 신호.</>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function BreakdownRow({
  name,
  count,
  barPct,
  filteredPct,
  concentration,
}: {
  name: string;
  count: number;
  barPct: number;
  filteredPct: number;
  concentration: number;
}) {
  // Concentration tone: >=2 = hot, 1-2 = normal, <1 = under-represented
  const concColor =
    concentration >= 2 ? "text-success font-semibold"
    : concentration >= 1 ? "text-foreground"
    : "text-muted-foreground";
  const concEmoji = concentration >= 3 ? "🔥" : concentration >= 2 ? "⬆️" : concentration >= 1 ? "◆" : "▽";

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-muted/30">
          <div
            className="absolute left-0 top-0 h-full bg-primary/40"
            style={{ width: `${barPct}%` }}
          />
          <span className="absolute left-2 top-0 flex h-full items-center text-xs truncate">
            {name}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="w-8 text-right text-muted-foreground">{count}</span>
        <span className="w-12 text-right">{filteredPct.toFixed(0)}%</span>
        <span className={cn("w-14 text-right", concColor)}>
          {concEmoji} {concentration > 0 ? `${concentration.toFixed(1)}×` : "-"}
        </span>
      </div>
    </div>
  );
}

function countBy<T>(rows: T[], keyOf: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
