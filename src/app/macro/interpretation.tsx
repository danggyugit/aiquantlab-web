import { cn } from "@/lib/utils";

export type Direction = "up_bullish" | "down_bullish" | "neutral";
export type Status = "bullish" | "bearish" | "neutral";

/**
 * 각 매크로 지표 카드 하단에 붙이는 해석 배너.
 *   direction: 이 지표가 어느 방향으로 움직여야 주식시장에 우호적인가
 *   status:    현재 값이 우호적/부담/중립 중 어디에 위치하는가
 *   note:      한 줄 부연 설명 (기준값 등)
 */
export function Interpretation({
  direction,
  status,
  note,
}: {
  direction: Direction;
  status: Status;
  note: string;
}) {
  const dirLabel =
    direction === "up_bullish" ? "▲ 상승 시 시장 우호적"
    : direction === "down_bullish" ? "▼ 하락 시 시장 우호적"
    : "◆ 방향보다 절대값이 중요";
  const dirColor =
    direction === "up_bullish" ? "text-success"
    : direction === "down_bullish" ? "text-destructive"
    : "text-muted-foreground";

  const statusLabel =
    status === "bullish" ? "🟢 현재 우호적"
    : status === "bearish" ? "🔴 현재 부담"
    : "⚪ 현재 중립";
  const statusColor =
    status === "bullish" ? "text-success"
    : status === "bearish" ? "text-destructive"
    : "text-muted-foreground";

  return (
    <div className="mt-2 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className={cn("font-semibold", dirColor)}>{dirLabel}</span>
        <span className={cn("font-semibold", statusColor)}>{statusLabel}</span>
      </div>
      <p className="mt-0.5 text-muted-foreground">{note}</p>
    </div>
  );
}

// ── 지표별 임계치 헬퍼 ───────────────────────────────────────

/**
 * Reserve 지표에서 흔히 쓰이는 임계 기반 상태 판정.
 *   thresholds = { good: X, bad: Y, mode: 'lower-better' | 'higher-better' }
 */
export function statusFromThreshold(
  value: number | null | undefined,
  goodBelow: number,
  badAbove: number,
  mode: "lower-better" | "higher-better",
): Status {
  if (value === null || value === undefined || Number.isNaN(value)) return "neutral";
  if (mode === "lower-better") {
    if (value <= goodBelow) return "bullish";
    if (value >= badAbove) return "bearish";
    return "neutral";
  } else {
    if (value >= goodBelow) return "bullish"; // "goodBelow" reused as "goodAbove"
    if (value <= badAbove) return "bearish";
    return "neutral";
  }
}

/** CPI-style: 2% ideal, > 4% bad, deflation risk if < 1%. */
export function inflationStatus(value: number | null | undefined): Status {
  if (value === null || value === undefined || Number.isNaN(value)) return "neutral";
  if (value >= 2 && value <= 3) return "bullish";
  if (value > 4 || value < 1) return "bearish";
  return "neutral";
}
