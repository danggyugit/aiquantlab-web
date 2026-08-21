import { cn } from "@/lib/utils";
import type { Sector } from "@/lib/data";

/** 성과가 강할수록 진하게 (0~10% → 알파 0.15~0.9). */
function performanceColor(pct: number): string {
  const magnitude = Math.min(Math.abs(pct) / 10, 1);
  const alpha = 0.15 + magnitude * 0.75;
  return pct >= 0
    ? `rgba(16, 185, 129, ${alpha.toFixed(2)})`
    : `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
}

export function SectorStrip({ sectors }: { sectors: Sector[] }) {
  const sorted = [...sectors].sort((a, b) => b.ret_1w_pct - a.ret_1w_pct);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {sorted.map((s) => {
        const isUp = s.ret_1w_pct >= 0;
        return (
          <div
            key={s.ticker}
            className="rounded-lg border border-border/40 p-3"
            style={{ backgroundColor: performanceColor(s.ret_1w_pct) }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold text-foreground">{s.sector}</span>
              <span className="text-[10px] font-mono text-foreground/70">{s.ticker}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-foreground/70">1주</span>
              <span
                className={cn("font-semibold tabular-nums", isUp ? "text-success" : "text-destructive")}
              >
                {isUp ? "+" : ""}
                {s.ret_1w_pct.toFixed(2)}%
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
              <span className="text-foreground/70">1개월</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  s.ret_1m_pct >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {s.ret_1m_pct >= 0 ? "+" : ""}
                {s.ret_1m_pct.toFixed(2)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
