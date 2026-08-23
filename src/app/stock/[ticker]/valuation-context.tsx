import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinnhubMetric } from "@/lib/finnhub";

/**
 * Historical valuation context card — approximates the "5-year P/E band"
 * ask (Tier 1 #8) using what Finnhub's free-tier /stock/metric endpoint
 * gives us: 52-week price range, TTM PE / PS / PB, and (when available)
 * high/low PE fields.
 *
 * Not a full 5-yr band (would need historical EPS × price series), but
 * enough to answer "is this stock at the cheap/expensive end of its
 * recent range?" — which is 80% of the decision value.
 */

export function ValuationContextCard({
  metric,
  currentPrice,
}: {
  metric: FinnhubMetric | null;
  currentPrice: number | null;
}) {
  if (!metric) return null;

  // 52-week price position (0 = at low, 100 = at high)
  const hi52 = metric["52WeekHigh"] as number | undefined;
  const lo52 = metric["52WeekLow"] as number | undefined;
  const pricePosition = currentPrice && hi52 && lo52 && hi52 > lo52
    ? ((currentPrice - lo52) / (hi52 - lo52)) * 100
    : null;

  // PE 52-week range if Finnhub gives it (varies by ticker)
  const peTTM = metric.peBasicExclExtraTTM as number | undefined;
  const peHi = metric["peBasicExclExtraTTMHigh" as keyof FinnhubMetric] as number | undefined
    ?? metric["peInclExtraHigh" as keyof FinnhubMetric] as number | undefined;
  const peLo = metric["peBasicExclExtraTTMLow" as keyof FinnhubMetric] as number | undefined
    ?? metric["peInclExtraLow" as keyof FinnhubMetric] as number | undefined;
  const pePosition = peTTM && peHi && peLo && peHi > peLo
    ? ((peTTM - peLo) / (peHi - peLo)) * 100
    : null;

  // P/S 52-week range
  const psTTM = metric.psTTM as number | undefined;
  const psHi = metric["psTTMHigh" as keyof FinnhubMetric] as number | undefined;
  const psLo = metric["psTTMLow" as keyof FinnhubMetric] as number | undefined;
  const psPosition = psTTM && psHi && psLo && psHi > psLo
    ? ((psTTM - psLo) / (psHi - psLo)) * 100
    : null;

  // If we don't have any range data, don't render
  if (pricePosition === null && pePosition === null && psPosition === null) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">📏 밸류에이션 위치 (52주 밴드)</CardTitle>
        <CardDescription className="text-xs">
          현재가 · P/E · P/S가 최근 1년 범위 중 어디에 위치하는가 — 매수/매도 타이밍 참고
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {pricePosition !== null && lo52 && hi52 && currentPrice && (
          <BandRow label="주가" value={currentPrice} low={lo52} high={hi52} position={pricePosition} format="usd" />
        )}
        {pePosition !== null && peLo && peHi && peTTM && (
          <BandRow label="P/E (TTM)" value={peTTM} low={peLo} high={peHi} position={pePosition} format="mul" lowerBetter />
        )}
        {psPosition !== null && psLo && psHi && psTTM && (
          <BandRow label="P/S (TTM)" value={psTTM} low={psLo} high={psHi} position={psPosition} format="mul" lowerBetter />
        )}
        <p className="text-[11px] text-muted-foreground">
          <strong className="text-foreground">해석</strong>: 0% 근처 = 최근 1년 저점권 (매수 관점 유리),
          100% 근처 = 고점권 (매수 부담). P/E·P/S는 낮을수록 저평가.
        </p>
      </CardContent>
    </Card>
  );
}

function BandRow({
  label,
  value,
  low,
  high,
  position,
  format,
  lowerBetter,
}: {
  label: string;
  value: number;
  low: number;
  high: number;
  position: number;   // 0-100
  format: "usd" | "mul";
  lowerBetter?: boolean;
}) {
  const fmt = (v: number) => format === "usd" ? `$${v.toFixed(2)}` : `${v.toFixed(1)}x`;
  // Position tone: for prices, low = green (cheap = good to buy);
  // for PE/PS, low position = green (cheap valuation)
  const isCheap = position <= 33;
  const isExpensive = position >= 67;
  const positionColor = lowerBetter
    ? (isCheap ? "text-success" : isExpensive ? "text-destructive" : "text-muted-foreground")
    : (isCheap ? "text-destructive" : isExpensive ? "text-success" : "text-muted-foreground");
  // For price bar we always use the gradient (red→amber→green)
  // For PE/PS bar we flip (green→amber→red)
  const gradientClass = lowerBetter
    ? "bg-gradient-to-r from-success via-amber-400 to-destructive"
    : "bg-gradient-to-r from-destructive via-amber-400 to-success";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <span className={cn("font-mono tabular-nums", positionColor)}>
          현재 {fmt(value)} · {position.toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="w-12 text-right tabular-nums">{fmt(low)}</span>
        <div className={cn("relative h-2 flex-1 overflow-hidden rounded-full", gradientClass)}>
          <div
            className="absolute top-0 h-full w-1 bg-foreground shadow-lg"
            style={{ left: `${Math.min(100, Math.max(0, position))}%`, transform: "translateX(-50%)" }}
          />
        </div>
        <span className="w-12 tabular-nums">{fmt(high)}</span>
      </div>
    </div>
  );
}
