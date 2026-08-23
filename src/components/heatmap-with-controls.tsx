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
}: {
  tickers: TickerInput[];
  sectors: Sector[];
  heatmapHeight?: number;
  defaultPeriod?: HeatmapPeriod;
}) {
  const [period, setPeriod] = useState<HeatmapPeriod>(defaultPeriod);

  const meta = PERIOD_META.find((p) => p.key === period) ?? PERIOD_META[0];

  // Ticker data filtered by whether that period is available for that ticker.
  const heatmapData: FinvizTicker[] = useMemo(() => {
    return tickers
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
  }, [tickers, period]);

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
    </div>
  );
}
