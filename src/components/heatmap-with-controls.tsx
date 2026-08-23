"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { HeatmapPeriod, Sector } from "@/lib/data";
import { FinvizHeatmap, type FinvizTicker } from "@/components/finviz-heatmap";

/**
 * Period-toggle wrapper around the Finviz heatmap + sector strip.
 * One toggle drives both cards — clicking "1M" recolors the treemap AND
 * the sector cards to that period. Uses backend-precomputed returns
 * (heatmap.tickers[].returns + snapshot.sectors[].ret_*_pct).
 */

type TickerInput = {
  ticker: string;
  sector: string;
  industry?: string | null;   // finer-grained bucket for the industry table
  marketCap: number;
  returns: Record<string, number | null | undefined>; // {1d,1w,1m,3m,6m,ytd,1y}
};

const PERIOD_META: Array<{ key: HeatmapPeriod; label: string; sectorField: keyof Sector }> = [
  { key: "1d",  label: "1일",  sectorField: "ret_1d_pct" },
  { key: "1w",  label: "1주",  sectorField: "ret_1w_pct" },
  { key: "1m",  label: "1개월", sectorField: "ret_1m_pct" },
  { key: "3m",  label: "3개월", sectorField: "ret_3m_pct" },
  { key: "6m",  label: "6개월", sectorField: "ret_6m_pct" },
  { key: "ytd", label: "YTD",  sectorField: "ret_ytd_pct" },
  { key: "1y",  label: "1년",  sectorField: "ret_1y_pct" },
];

function performanceColor(pct: number): string {
  const magnitude = Math.min(Math.abs(pct) / 10, 1);
  const alpha = 0.15 + magnitude * 0.75;
  return pct >= 0
    ? `rgba(16, 185, 129, ${alpha.toFixed(2)})`
    : `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
}

export function HeatmapWithControls({
  tickers,
  sectors,
  heatmapHeight = 900,
  defaultPeriod = "1d",
  heatmapLimit = 500,
  showIndustryTable = true,
}: {
  tickers: TickerInput[];
  sectors: Sector[];
  heatmapHeight?: number;
  defaultPeriod?: HeatmapPeriod;
  /** Top-N by market cap that go into the treemap (industry table always uses all). */
  heatmapLimit?: number;
  /** Show the industry-level breakdown table below the heatmap. */
  showIndustryTable?: boolean;
}) {
  const [period, setPeriod] = useState<HeatmapPeriod>(defaultPeriod);

  const meta = PERIOD_META.find((p) => p.key === period) ?? PERIOD_META[0];

  // Ticker data filtered by whether that period is available for that ticker.
  // Only top-N by market cap go into the treemap (density control).
  const heatmapData: FinvizTicker[] = useMemo(() => {
    return [...tickers]
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, heatmapLimit)
      .map((t) => {
        const change = t.returns?.[period];
        if (change === null || change === undefined) return null;
        return {
          ticker: t.ticker,
          sector: t.sector,
          marketCap: t.marketCap,
          changePct: Number(change),
        } satisfies FinvizTicker;
      })
      .filter((x): x is FinvizTicker => x !== null);
  }, [tickers, period, heatmapLimit]);

  // Industry aggregation — every ticker (not just heatmap top-N).
  // Weighted by market cap so mega-caps drive the sector-industry read.
  type IndustryRow = {
    industry: string;
    sector: string;
    count: number;
    totalCap: number;
    weightedChange: number;   // sum(marketCap * change)
  };
  const industryRows = useMemo(() => {
    if (!showIndustryTable) return [];
    const map = new Map<string, IndustryRow>();
    for (const t of tickers) {
      if (!t.industry || !t.marketCap) continue;
      const change = t.returns?.[period];
      if (change === null || change === undefined) continue;
      const key = t.industry;
      let row = map.get(key);
      if (!row) {
        row = { industry: t.industry, sector: t.sector, count: 0, totalCap: 0, weightedChange: 0 };
        map.set(key, row);
      }
      row.count += 1;
      row.totalCap += t.marketCap;
      row.weightedChange += t.marketCap * Number(change);
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, wAvg: r.totalCap > 0 ? r.weightedChange / r.totalCap : 0 }))
      .sort((a, b) => b.wAvg - a.wAvg);
  }, [tickers, period, showIndustryTable]);

  // Sector data: pull the field for the selected period.
  const sectorRows = useMemo(() => {
    return [...sectors]
      .map((s) => {
        const raw = s[meta.sectorField];
        const val = typeof raw === "number" ? raw : null;
        return { ...s, currentChange: val };
      })
      .sort((a, b) => (b.currentChange ?? -Infinity) - (a.currentChange ?? -Infinity));
  }, [sectors, meta.sectorField]);

  return (
    <div className="flex flex-col gap-4">
      {/* Period picker */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Period
        </span>
        <div className="flex flex-wrap gap-1">
          {PERIOD_META.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                p.key === period
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/40 text-muted-foreground hover:bg-muted/40",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {heatmapData.length}종목 · 섹터 {sectorRows.length}개
        </span>
      </div>

      {/* Sector strip (period-aware) */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Sector Performance <span className="ml-1 text-xs font-normal text-muted-foreground">({meta.label} 기준)</span>
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {sectorRows.map((s) => {
            const val = s.currentChange;
            if (val === null) {
              return (
                <div
                  key={s.ticker}
                  className="rounded-lg border border-border/40 p-3 opacity-40"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{s.sector}</span>
                    <span className="text-[10px] font-mono text-foreground/70">{s.ticker}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">데이터 없음</div>
                </div>
              );
            }
            const isUp = val >= 0;
            return (
              <div
                key={s.ticker}
                className="rounded-lg border border-border/40 p-3"
                style={{ backgroundColor: performanceColor(val) }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{s.sector}</span>
                  <span className="text-[10px] font-mono text-foreground/70">{s.ticker}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-foreground/70">{meta.label}</span>
                  <span
                    className={cn("font-semibold tabular-nums", isUp ? "text-success" : "text-destructive")}
                  >
                    {isUp ? "+" : ""}{val.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Market heatmap (period-aware) */}
      <section>
        <h2 className="mb-2 text-lg font-semibold">
          Market Heatmap <span className="ml-1 text-xs font-normal text-muted-foreground">({meta.label} 기준)</span>
        </h2>
        {heatmapData.length > 0 ? (
          <FinvizHeatmap data={heatmapData} height={heatmapHeight} />
        ) : (
          <div className="flex h-[400px] items-center justify-center rounded-xl border border-border/40 bg-card/40 text-sm text-muted-foreground">
            이 기간의 캐시가 아직 생성되지 않았습니다 (다음 fetch_cache 실행 후 표시).
          </div>
        )}
        <p className="mt-2 text-[10px] text-muted-foreground">
          박스 크기 = 시가총액 · 색상 = {meta.label} 등락 · 클릭 시 상세 이동
        </p>
      </section>

      {/* Industry breakdown (finer than sector; period-aware) */}
      {showIndustryTable && industryRows.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Industry Breakdown <span className="ml-1 text-xs font-normal text-muted-foreground">({meta.label} 기준 · {industryRows.length}개 산업)</span>
            </h2>
            <span className="text-[11px] text-muted-foreground">시가총액 가중 평균 · 스크롤 가능</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto rounded-lg border border-border/40 bg-card/40">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border/60 bg-card text-left text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 w-8">#</th>
                  <th className="px-3 py-2">Industry</th>
                  <th className="px-3 py-2 hidden sm:table-cell">Sector</th>
                  <th className="px-3 py-2 text-right w-16">종목</th>
                  <th className="px-3 py-2 text-right w-24">가중 평균</th>
                  <th className="px-3 py-2 text-right w-24 hidden md:table-cell">총 시총</th>
                </tr>
              </thead>
              <tbody>
                {industryRows.map((r, i) => {
                  const isUp = r.wAvg >= 0;
                  return (
                    <tr key={r.industry} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{r.industry}</td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground hidden sm:table-cell">{r.sector}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground">{r.count}</td>
                      <td className={cn(
                        "px-3 py-1.5 text-right tabular-nums font-semibold",
                        isUp ? "text-success" : "text-destructive",
                      )}>
                        {isUp ? "+" : ""}{r.wAvg.toFixed(2)}%
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-xs text-muted-foreground hidden md:table-cell">
                        {fmtCap(r.totalCap)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function fmtCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9)  return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6)  return `$${(cap / 1e6).toFixed(1)}M`;
  return `$${cap.toFixed(0)}`;
}
