"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import {
  FACTOR_LIBRARY,
  runBacktest,
  type BacktestConfig,
  type BacktestResult,
  type BacktestUniverseItem,
  type FactorId,
  type Weighting,
} from "@/lib/backtest";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_FACTORS: FactorId[] = ["mom_high", "roe_high"];
const CAP_TIERS = ["all", "Large Cap", "Mid Cap", "Small Cap"] as const;
const N_STOCK_OPTIONS = [5, 10, 20, 30] as const;

const WEIGHTING_OPTIONS: { value: Weighting; label: string; desc: string }[] = [
  { value: "equal", label: "균등가중", desc: "모든 종목에 동일 비중" },
  { value: "mcap", label: "시가총액 가중", desc: "시가총액 비중으로 가중" },
  { value: "invvol", label: "역변동성 가중", desc: "변동성 낮은 종목에 더 많은 비중" },
];

type Props = { universe: BacktestUniverseItem[]; sectors: string[] };

export function BacktestLab({ universe, sectors }: Props) {
  const [config, setConfig] = useState<BacktestConfig>({
    factors: DEFAULT_FACTORS,
    weighting: "equal",
    sector: "all",
    capTier: "Large Cap",
    nStocks: 10,
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const canRun = config.factors.length > 0;

  function toggleFactor(id: FactorId) {
    setConfig((c) => ({
      ...c,
      factors: c.factors.includes(id) ? c.factors.filter((f) => f !== id) : [...c.factors, id],
    }));
  }

  function handleRun() {
    if (!canRun) return;
    setIsRunning(true);
    // Yield to the browser so the "Running..." state paints, then compute.
    setTimeout(() => {
      const r = runBacktest(universe, config);
      setResult(r);
      setIsRunning(false);
    }, 30);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Config panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">전략 구성</CardTitle>
          <CardDescription className="text-xs">
            팩터·가중·유니버스·종목 수를 선택 후 실행. 계산은 브라우저에서 즉시 수행됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Factor picker */}
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              팩터 <span className="text-primary">*</span>
            </Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {FACTOR_LIBRARY.map((f) => (
                <label
                  key={f.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors",
                    config.factors.includes(f.id)
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/40 hover:bg-muted/30",
                  )}
                >
                  <Checkbox
                    checked={config.factors.includes(f.id)}
                    onCheckedChange={() => toggleFactor(f.id)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.description}</div>
                  </div>
                </label>
              ))}
            </div>
            {config.factors.length === 0 && (
              <p className="mt-1.5 text-xs text-destructive">최소 1개 팩터를 선택하세요.</p>
            )}
          </div>

          {/* Grid: weighting / sector / capTier / nStocks */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                가중 방식
              </Label>
              <Select
                value={config.weighting}
                onValueChange={(v) => setConfig({ ...config, weighting: (v as string) as Weighting })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEIGHTING_OPTIONS.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                섹터 필터
              </Label>
              <Select
                value={config.sector}
                onValueChange={(v) => setConfig({ ...config, sector: (v as string) ?? "all" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 섹터</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                시가총액
              </Label>
              <Select
                value={config.capTier}
                onValueChange={(v) => setConfig({ ...config, capTier: (v as string) ?? "all" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAP_TIERS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "all" ? "전체 시총" : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                종목 수
              </Label>
              <Select
                value={String(config.nStocks)}
                onValueChange={(v) => setConfig({ ...config, nStocks: parseInt((v as string) ?? "10") })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {N_STOCK_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Top {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Run button */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-3">
            <div className="text-xs text-muted-foreground">
              선택 팩터 {config.factors.length}개 · Top {config.nStocks}
            </div>
            <Button
              onClick={handleRun}
              disabled={!canRun || isRunning}
              className="gap-1.5"
            >
              {isRunning ? (
                <>계산 중...</>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  백테스트 실행
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && result.picks.length > 0 && <BacktestResults result={result} config={config} />}
      {result && result.picks.length === 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-6 text-center text-sm text-destructive">
            선택한 조건에 맞는 종목이 없습니다. 필터를 완화해보세요.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BacktestResults({ result, config }: { result: BacktestResult; config: BacktestConfig }) {
  const outperform = result.excessReturn >= 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">백테스트 결과</CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {result.n_periods}일 · {result.dateStart} ~ {result.dateEnd}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile
              label="포트폴리오 수익률"
              value={fmtPct(result.portfolioReturn)}
              color={result.portfolioReturn >= 0 ? "text-success" : "text-destructive"}
            />
            <SummaryTile
              label="벤치마크 (유니버스 평균)"
              value={fmtPct(result.benchmarkReturn)}
              color={result.benchmarkReturn >= 0 ? "text-success" : "text-destructive"}
            />
            <SummaryTile
              label="초과수익률 (알파)"
              value={fmtPct(result.excessReturn)}
              color={outperform ? "text-success" : "text-destructive"}
              icon={outperform ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            />
            <SummaryTile
              label="연환산 변동성"
              value={`${result.volatility.toFixed(1)}%`}
              color="text-muted-foreground"
            />
          </div>
        </CardContent>
      </Card>

      {/* Best/Worst */}
      <div className="grid gap-3 sm:grid-cols-2">
        {result.bestPick && (
          <Card className="border-success/30 bg-success/5">
            <CardHeader className="pb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Best Pick
              </div>
            </CardHeader>
            <CardContent>
              <Link href={`/stock/${result.bestPick.ticker}`} className="text-sm font-semibold text-primary hover:underline">
                {result.bestPick.ticker}
              </Link>
              <div className="text-xs text-muted-foreground">{result.bestPick.name}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-success">
                {fmtPct(result.bestPick.periodReturn)}
              </div>
            </CardContent>
          </Card>
        )}
        {result.worstPick && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Worst Pick
              </div>
            </CardHeader>
            <CardContent>
              <Link href={`/stock/${result.worstPick.ticker}`} className="text-sm font-semibold text-primary hover:underline">
                {result.worstPick.ticker}
              </Link>
              <div className="text-xs text-muted-foreground">{result.worstPick.name}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-destructive">
                {fmtPct(result.worstPick.periodReturn)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Holdings */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">선정 포트폴리오 ({result.picks.length})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">회사</th>
                <th className="hidden px-3 py-2 sm:table-cell">섹터</th>
                <th className="px-3 py-2 text-right">스코어</th>
                <th className="px-3 py-2 text-right">가중치</th>
                <th className="px-3 py-2 text-right">기간 수익률</th>
              </tr>
            </thead>
            <tbody>
              {result.picks.map((p, i) => (
                <tr key={p.ticker} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                    <Link href={`/stock/${p.ticker}`} className="text-primary hover:underline">
                      {p.ticker}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2">{p.name}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{p.sector}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p.score.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{(p.weight * 100).toFixed(2)}%</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold",
                      p.periodReturn >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {fmtPct(p.periodReturn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sector allocation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">섹터 배분</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {result.sectorAllocation.map((s) => (
            <div key={s.sector} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-xs">{s.sector}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${s.weight * 100}%` }}
                />
              </div>
              <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                {(s.weight * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">계산 방식:</strong> 유니버스 {result.universeSize}개 종목 중 팩터 백분위 스코어 상위 {config.nStocks}개 선정.
        가중치는 <strong>{WEIGHTING_OPTIONS.find(w => w.value === config.weighting)?.label}</strong> 방식.
        수익률은 캐시 기간({result.n_periods}일) 종가 기준 누적 수익률.
        <br />
        <strong className="text-foreground">데이터 한계:</strong> 현재 heatmap 캐시가 최근 5거래일만 저장 →
        Sharpe·MDD 등 통계적 지표는 산출하지 않음. 12M 히스토리 캐시 확장 시 정식 백테스트 지표 제공.
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  color,
  icon,
}: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 flex items-baseline gap-1 text-2xl font-bold tabular-nums", color)}>
        {value}
        {icon}
      </div>
    </div>
  );
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}
