import { getAllBacktestPresets, type BacktestPreset } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, Target, TrendingUp } from "lucide-react";

export const metadata = { title: "Factor Lab · AI Quant Lab" };
export const revalidate = 900;

function MetricPill({
  label,
  value,
  isGood,
  digits = 1,
  suffix = "",
}: {
  label: string;
  value: number | undefined;
  isGood?: (v: number) => boolean;
  digits?: number;
  suffix?: string;
}) {
  if (value === undefined || value === null) {
    return (
      <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-sm text-muted-foreground">-</div>
      </div>
    );
  }
  const good = isGood?.(value);
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums",
          good === true && "text-success",
          good === false && "text-destructive",
        )}
      >
        {value.toFixed(digits)}
        {suffix}
      </div>
    </div>
  );
}

function PresetCard({ preset }: { preset: BacktestPreset }) {
  const s = preset.summary;
  const picks = preset.today_picks?.length ? preset.today_picks : preset.latest_picks ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight">{preset.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2 text-xs">
              {preset.description}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {preset.preset_id}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Performance metrics */}
        <div className="grid grid-cols-4 gap-1.5">
          <MetricPill label="CAGR" value={s.cagr_pct} suffix="%" isGood={(v) => v > 10} />
          <MetricPill label="Sharpe" value={s.sharpe} digits={2} isGood={(v) => v > 1} />
          <MetricPill label="MDD" value={s.mdd_pct} suffix="%" isGood={(v) => v > -20} />
          <MetricPill label="Sortino" value={s.sortino} digits={2} isGood={(v) => v > 1} />
        </div>

        {/* Rebalance info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {preset.last_rebalance_date && (
            <span>
              마지막 리밸런싱: <span className="text-foreground">{preset.last_rebalance_date}</span>
            </span>
          )}
          {preset.last_regime && (
            <span>
              레짐: <span className="text-foreground">{preset.last_regime}</span>
            </span>
          )}
          {preset.last_cash_ratio_pct !== undefined && (
            <span>
              현금: <span className="text-foreground">{preset.last_cash_ratio_pct}%</span>
            </span>
          )}
        </div>

        {/* Latest picks */}
        {picks.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              최신 편입 종목 ({picks.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {picks.slice(0, 15).map((p) => (
                <span
                  key={p.ticker}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-mono font-semibold"
                >
                  {p.ticker}
                  {p.weight !== undefined && (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {(p.weight * 100).toFixed(1)}%
                    </span>
                  )}
                </span>
              ))}
              {picks.length > 15 && (
                <span className="text-xs text-muted-foreground">+{picks.length - 15}개</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function FactorLabPage() {
  const presets = await getAllBacktestPresets();

  // Rank by CAGR (best first) for the summary section
  const sorted = [...presets].sort(
    (a, b) => (b.summary.cagr_pct ?? 0) - (a.summary.cagr_pct ?? 0),
  );
  const best = sorted[0];
  const bestSharpe = [...presets].sort((a, b) => (b.summary.sharpe ?? 0) - (a.summary.sharpe ?? 0))[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Factor Lab</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          IT 섹터 팩터 전략 백테스트 결과 · PIT 데이터 + 21일 embargo 적용
        </p>
      </header>

      {/* Best-of highlights */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-success/15 p-1.5">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                최고 CAGR
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">{best.name}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-success">
              {best.summary.cagr_pct?.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/15 p-1.5">
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                최고 Sharpe
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">{bestSharpe.name}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-primary">
              {bestSharpe.summary.sharpe?.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preset cards */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">전체 프리셋 ({presets.length})</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {sorted.map((p) => (
            <PresetCard key={p.preset_id} preset={p} />
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        <Activity className="mr-1 inline h-3 w-3" />
        커스텀 팩터 조합·백테스트 실행 기능은 백엔드(FastAPI) 도입 후 제공됩니다.
      </p>
    </div>
  );
}
