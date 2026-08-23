"use client";

import Link from "next/link";
import type { BacktestPreset } from "@/lib/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EquityCurve } from "./equity-curve";
import { IcChart } from "./ic-chart";
import { ImportanceChart } from "./importance-chart";
import { AlertCircle } from "lucide-react";

// Mirrors Streamlit's 8-tab result panel (Summary / Live Picks / Performance / IC / History / Importance / Heatmap / Tracking).
export function ResultTabs({
  preset,
  exact,
  source = "preset",
}: {
  preset: BacktestPreset;
  exact: boolean;
  source?: "preset" | "api";
}) {
  const s = preset.summary;
  const full = preset.full;

  return (
    <div className="flex flex-col gap-4">
      {source === "api" && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-xs text-success">
          <AlertCircle className="mr-1 inline h-3 w-3" />
          <strong>실시간 백테스트 결과:</strong> 사용자 config로 FastAPI 백엔드가 방금 계산한 결과입니다.
        </div>
      )}
      {source === "preset" && !exact && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
          <AlertCircle className="mr-1 inline h-3 w-3 text-amber-400" />
          <strong className="text-amber-400">가장 가까운 프리셋:</strong> "{preset.name}". 커스텀 config 실행은 Python 백엔드가 필요해서 (yfinance·SEC·ML 학습),
          현재는 매일 미리 계산된 5개 프리셋 중 가장 유사한 것을 로드합니다.
        </div>
      )}

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="flex flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="summary" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Summary</TabsTrigger>
          <TabsTrigger value="live" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Live Picks</TabsTrigger>
          <TabsTrigger value="perf" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Performance</TabsTrigger>
          <TabsTrigger value="ic" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">IC</TabsTrigger>
          <TabsTrigger value="history" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">History</TabsTrigger>
          <TabsTrigger value="importance" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Importance</TabsTrigger>
          <TabsTrigger value="heatmap" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Heatmap</TabsTrigger>
          <TabsTrigger value="tracking" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Tracking</TabsTrigger>
        </TabsList>

        {/* --- Tab 1: Summary --- */}
        <TabsContent value="summary" className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="총 수익률" value={fmtPct(s.total_return_pct)} tone={pos(s.total_return_pct)} />
            <Metric label="CAGR" value={fmtPct(s.cagr_pct)} tone={pos(s.cagr_pct)} />
            <Metric label="Sharpe" value={s.sharpe?.toFixed(2)} tone={s.sharpe && s.sharpe > 1 ? "success" : "neutral"} />
            <Metric label="Sortino" value={s.sortino?.toFixed(2)} tone={s.sortino && s.sortino > 1 ? "success" : "neutral"} />
            <Metric label="MDD" value={fmtPct(s.max_dd_pct)} tone={s.max_dd_pct && s.max_dd_pct > -20 ? "success" : "danger"} />
            <Metric label="월간 승률" value={fmtPct(s.monthly_win_rate_pct)} tone={s.monthly_win_rate_pct && s.monthly_win_rate_pct > 50 ? "success" : "neutral"} />
          </div>

          {/* SPY 벤치마크 대비 초과성과 + 회전율. Live Picks 산출 방식 개선안 #4/#8. */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric
              label="Alpha (연율)"
              value={fmtPct(s.alpha_annual_pct)}
              tone={pos(s.alpha_annual_pct)}
              hint={s.spy_cagr_pct !== undefined ? `SPY ${fmtPct(s.spy_cagr_pct)}` : undefined}
            />
            <Metric
              label="SPY CAGR"
              value={fmtPct(s.spy_cagr_pct)}
              tone="neutral"
              hint="동일 기간 벤치마크"
            />
            <Metric
              label="평균 회전율"
              value={fmtPct(s.avg_turnover_pct)}
              tone={s.avg_turnover_pct !== undefined && s.avg_turnover_pct < 50 ? "success" : "neutral"}
              hint="리밸런싱당"
            />
            <Metric
              label="연 회전율"
              value={fmtPct(s.annual_turnover_pct)}
              tone={s.annual_turnover_pct !== undefined && s.annual_turnover_pct < 300 ? "success" : "neutral"}
              hint="거래비용 부담 지표"
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">누적 수익률 (Equity Curve)</CardTitle>
              <CardDescription className="text-xs">
                초기 자본 1.0 기준 · 리밸런싱 {s.n_rebalances}회
                {full?.benchmark_series && full.benchmark_series.length > 0 && " · SPY 오버레이 포함"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {full ? (
                <EquityCurve
                  dates={full.port_dates}
                  values={full.port_values}
                  benchmark={full.benchmark_series}
                />
              ) : (
                <NoData />
              )}
            </CardContent>
          </Card>

          {preset.today_full_ranking && preset.today_full_ranking.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">Live Picks 전체 랭킹 · Top 10</CardTitle>
                  {preset.today_picks_at && (
                    <Badge variant="secondary" className="text-[10px]">
                      {preset.today_picks_at.slice(0, 10)}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  ML 모델이 예측한 오늘의 전체 유니버스 랭킹 (총 {preset.today_full_ranking.length}종목).
                  전체 리스트는 Live Picks 탭에서 확인.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RankingTable
                  rows={preset.today_full_ranking.slice(0, 10)}
                  totalRanked={preset.today_full_ranking.length}
                  isEnsemble={full?.use_ensemble ?? false}
                />
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Profit Factor" value={s.profit_factor?.toFixed(2)} tone={s.profit_factor && s.profit_factor > 1.5 ? "success" : "neutral"} />
            <Metric label="리밸런싱 승률" value={fmtPct(s.rebal_win_rate_pct)} tone="neutral" />
            <Metric label="평균 초과수익" value={fmtPct(s.avg_excess_return_pct)} tone={pos(s.avg_excess_return_pct)} />
          </div>
        </TabsContent>

        {/* --- Tab 2: Live Picks --- */}
        <TabsContent value="live" className="mt-4 flex flex-col gap-4">
          {full?.use_ensemble && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
              💡 <strong className="text-foreground">모델 dispersion 읽는 법</strong>:
              <span className="ml-1">
                <strong>σ</strong>는 RF·XGB·LGBM 3개 모델 예측의 표준편차 (작을수록 합의 강함).
                <strong> 합의</strong>는 양(+)의 예측을 낸 모델 수 (3/3 = 만장일치, 1/3 = 이견 큼).
                모델간 합의가 강한 종목일수록 신뢰도 높음.
              </span>
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">오늘의 추천 종목</CardTitle>
                {preset.today_picks_at && (
                  <Badge variant="secondary" className="text-[10px]">
                    {preset.today_picks_at.slice(0, 10)}
                  </Badge>
                )}
                {preset.today_regime && (
                  <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px]">
                    Regime: {preset.today_regime}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                {preset.today_cash_ratio_pct !== undefined && preset.today_cash_ratio_pct !== null
                  ? `현금 비중 ${preset.today_cash_ratio_pct}%`
                  : "현금 없음"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PicksTable picks={preset.today_picks ?? []} isEnsemble={full?.use_ensemble ?? false} />
            </CardContent>
          </Card>
          {preset.today_full_ranking && preset.today_full_ranking.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">전체 랭킹 <span className="text-xs font-normal text-muted-foreground">({preset.today_full_ranking.length})</span></CardTitle>
              </CardHeader>
              <CardContent>
                <RankingTable
                  rows={preset.today_full_ranking.slice(0, 30)}
                  totalRanked={preset.today_full_ranking.length}
                  isEnsemble={full?.use_ensemble ?? false}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* --- Tab 3: Performance --- */}
        <TabsContent value="perf" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">누적 수익률</CardTitle>
            </CardHeader>
            <CardContent>
              {full ? (
                <EquityCurve
                  dates={full.port_dates}
                  values={full.port_values}
                  benchmark={full.benchmark_series}
                />
              ) : (
                <NoData />
              )}
            </CardContent>
          </Card>
          {full && <MonthlyReturnsCard dates={full.port_dates} values={full.port_values} />}
        </TabsContent>

        {/* --- Tab 4: IC --- */}
        <TabsContent value="ic" className="mt-4 flex flex-col gap-4">
          {full && full.ic_records.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Metric label="IC 평균" value={computeIcMean(full.ic_records).toFixed(4)} tone="neutral" />
                <Metric label="IC 표준편차" value={computeIcStd(full.ic_records).toFixed(4)} tone="neutral" />
                <Metric label="양성 비율" value={fmtPct(computeIcPositiveRate(full.ic_records))} tone={computeIcPositiveRate(full.ic_records) > 50 ? "success" : "neutral"} />
              </div>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">IC 시계열</CardTitle>
                  <CardDescription className="text-xs">각 리밸런싱 시점의 예측력 지표 (양의 값 = 예측 방향 일치)</CardDescription>
                </CardHeader>
                <CardContent>
                  <IcChart records={full.ic_records} />
                </CardContent>
              </Card>
            </>
          ) : (
            <NoData label="IC 기록 없음" />
          )}
        </TabsContent>

        {/* --- Tab 5: History --- */}
        <TabsContent value="history" className="mt-4">
          {full && full.rebal_hist.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">리밸런싱 이력 ({full.rebal_hist.length}회)</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border/60 bg-muted/20 text-left text-[10px] text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">리밸런싱일</th>
                      <th className="px-3 py-2">보유 기간</th>
                      <th className="px-3 py-2">선정 종목</th>
                    </tr>
                  </thead>
                  <tbody>
                    {full.rebal_hist.slice().reverse().map((r, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-3 py-2 text-muted-foreground">{r.rebalance_date.slice(0, 10)}</td>
                        <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.holding_period}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {r.selected.map((t) => (
                              <Link
                                key={t}
                                href={`/stock/${t}`}
                                className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary hover:bg-primary/20"
                              >
                                {t}
                              </Link>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <NoData label="리밸런싱 이력 없음" />
          )}
        </TabsContent>

        {/* --- Tab 6: Importance --- */}
        <TabsContent value="importance" className="mt-4">
          {full && full.fimp_data.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">특성 중요도 (평균 · Top 15)</CardTitle>
                <CardDescription className="text-xs">
                  모든 리밸런싱 시점의 특성 중요도 평균값. 상위 15개.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImportanceChart records={full.fimp_data} />
              </CardContent>
            </Card>
          ) : (
            <NoData label="특성 중요도 데이터 없음" />
          )}
        </TabsContent>

        {/* --- Tab 7: Heatmap --- */}
        <TabsContent value="heatmap" className="mt-4">
          {full && full.fimp_data.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">특성 중요도 히트맵 (시간 축)</CardTitle>
                <CardDescription className="text-xs">
                  X축: 리밸런싱 시점 · Y축: 상위 특성 · 색상 강도: 중요도
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HeatmapGrid records={full.fimp_data} />
              </CardContent>
            </Card>
          ) : (
            <NoData label="히트맵 데이터 없음" />
          )}
        </TabsContent>

        {/* --- Tab 8: Tracking --- */}
        <TabsContent value="tracking" className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Alpha (연율)" value={fmtPct(s.alpha_annual_pct)} tone={pos(s.alpha_annual_pct)} hint="AI − SPY CAGR" />
            <Metric label="Portfolio CAGR" value={fmtPct(s.cagr_pct)} tone={pos(s.cagr_pct)} />
            <Metric label="SPY CAGR" value={fmtPct(s.spy_cagr_pct)} tone="neutral" hint="동일 기간" />
            <Metric label="평균 초과수익" value={fmtPct(s.avg_excess_return_pct)} tone={pos(s.avg_excess_return_pct)} hint="리밸런싱당 vs 유니버스 평균" />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">SPY 대비 누적 성과</CardTitle>
              <CardDescription className="text-xs">
                실선 = AI 포트폴리오 · 점선 = SPY (동일 기간, 초기값 1.0 정규화)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {full ? (
                <EquityCurve
                  dates={full.port_dates}
                  values={full.port_values}
                  benchmark={full.benchmark_series}
                />
              ) : (
                <NoData />
              )}
              {full && (!full.benchmark_series || full.benchmark_series.length === 0) && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  이 프리셋의 캐시에는 아직 SPY 벤치마크가 포함되지 않았습니다. 다음 배치 실행 후 표시됩니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Sub-components ----------

function Metric({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number | undefined;
  tone: "success" | "danger" | "neutral";
  hint?: string;
}) {
  const color =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xl font-bold tabular-nums", color)}>{value ?? "-"}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function NoData({ label = "데이터 없음" }: { label?: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">{label}</div>
  );
}

/**
 * composite_score의 두 얼굴:
 *  - 앙상블 모드: `-((RF+XGB+LGBM 순위) / 3)` — 음수 정수, 절댓값이 순위(작을수록 좋음)
 *  - 비앙상블: `RF 모델의 예측 수익률` — 소수 (0.19 = 19%)
 * UI에서 하나의 컬럼으로 표시하면 오해가 발생하므로 스마트하게 분기.
 */
function formatScore(score: number | undefined, isEnsemble: boolean, total: number): string {
  if (score === undefined || score === null || Number.isNaN(score)) return "-";
  if (isEnsemble) {
    // Absolute value = average rank (1 = best). Display as "avg rank / total".
    const avgRank = Math.abs(score);
    return `${avgRank.toFixed(1)} / ${total}`;
  }
  // Non-ensemble: raw predicted return (0.19 → +19.0%)
  const pct = score * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function scoreLabel(isEnsemble: boolean): string {
  return isEnsemble ? "모델 순위 (평균)" : "예측 수익률";
}

function scoreTone(score: number | undefined, isEnsemble: boolean, total: number): "success" | "danger" | "neutral" {
  if (score === undefined || score === null) return "neutral";
  if (isEnsemble) {
    // Top 20% of ranks = success
    const avgRank = Math.abs(score);
    if (avgRank <= total * 0.2) return "success";
    if (avgRank >= total * 0.8) return "danger";
    return "neutral";
  }
  return score >= 0 ? "success" : "danger";
}

// Format momentum feature value (raw factor space — may be extreme due to
// winsorization at ~7 for 12M returns, or normalized elsewhere).
function fmtMom(v: number | undefined): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "-";
  const pct = v * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function fmtVol(v: number | undefined): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "-";
  return `${(v * 100).toFixed(0)}%`;
}

function PicksTable({
  picks,
  isEnsemble,
}: { picks: import("@/lib/data").TodayPick[]; isEnsemble: boolean }) {
  if (picks.length === 0) return <NoData label="추천 종목 없음" />;
  const total = picks.length; // for weight column context (picks are the selected N)
  const hasBreakdown = picks.some((p) => p.model_agreement || p.pred_std !== undefined);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Ticker</th>
            <th className="px-3 py-2 text-right">비중</th>
            <th className="px-3 py-2 text-right">{scoreLabel(isEnsemble)}</th>
            {hasBreakdown && (
              <>
                <th className="px-3 py-2 text-right hidden md:table-cell" title="모델간 예측 표준편차 — 작을수록 합의 강함">
                  σ
                </th>
                <th className="px-3 py-2 text-center hidden sm:table-cell" title="양의 예측을 한 모델 수 / 총 모델 수">
                  합의
                </th>
              </>
            )}
            <th className="px-3 py-2 text-right hidden sm:table-cell">Mom 3M</th>
            <th className="px-3 py-2 text-right hidden md:table-cell">Mom 12M</th>
            <th className="px-3 py-2 text-right hidden lg:table-cell">30d 변동성</th>
          </tr>
        </thead>
        <tbody>
          {picks.map((p) => {
            const tone = scoreTone(p.composite_score, isEnsemble, total);
            const scoreColor = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
            return (
              <tr key={p.ticker} className="border-b border-border/30">
                <td className="px-3 py-2 font-mono text-xs font-semibold">
                  <Link href={`/stock/${p.ticker}`} className="text-primary hover:underline">{p.ticker}</Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.weight !== undefined ? `${(p.weight * 100).toFixed(1)}%` : "-"}
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", scoreColor)}>
                  {formatScore(p.composite_score, isEnsemble, total)}
                </td>
                {hasBreakdown && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell text-muted-foreground">
                      {fmtStd(p.pred_std)}
                    </td>
                    <td className="px-3 py-2 text-center hidden sm:table-cell">
                      <AgreementBadge value={p.model_agreement} />
                    </td>
                  </>
                )}
                <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{fmtMom(p.Mom_3m)}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{fmtMom(p.Mom_12m)}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell text-muted-foreground">{fmtVol(p.Volatility_30d)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RankingTable({
  rows,
  totalRanked,
  isEnsemble,
}: {
  rows: import("@/lib/data").RankingEntry[];
  totalRanked: number;
  isEnsemble: boolean;
}) {
  const hasBreakdown = rows.some((r) => r.model_agreement || r.pred_std !== undefined);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 w-10">#</th>
            <th className="px-3 py-2">Ticker</th>
            <th className="px-3 py-2 text-right">{scoreLabel(isEnsemble)}</th>
            {hasBreakdown && (
              <>
                <th className="px-3 py-2 text-right hidden md:table-cell" title="모델간 예측 표준편차">σ</th>
                <th className="px-3 py-2 text-center hidden sm:table-cell" title="양의 예측을 한 모델 수">합의</th>
              </>
            )}
            <th className="px-3 py-2 text-right hidden sm:table-cell">Mom 3M</th>
            <th className="px-3 py-2 text-right hidden md:table-cell">Mom 12M</th>
            <th className="px-3 py-2 text-right hidden lg:table-cell">30d 변동성</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const tone = scoreTone(r.composite_score, isEnsemble, totalRanked);
            const scoreColor = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
            const rank = i + 1;
            const isTop3 = rank <= 3;
            return (
              <tr key={r.ticker} className="border-b border-border/30">
                <td className={cn("px-3 py-2 text-xs tabular-nums", isTop3 ? "font-bold text-primary" : "text-muted-foreground")}>
                  {rank}
                </td>
                <td className="px-3 py-2 font-mono text-xs font-semibold">
                  <Link href={`/stock/${r.ticker}`} className="text-primary hover:underline">{r.ticker}</Link>
                </td>
                <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", scoreColor)}>
                  {formatScore(r.composite_score, isEnsemble, totalRanked)}
                </td>
                {hasBreakdown && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell text-muted-foreground">
                      {fmtStd(r.pred_std)}
                    </td>
                    <td className="px-3 py-2 text-center hidden sm:table-cell">
                      <AgreementBadge value={r.model_agreement} />
                    </td>
                  </>
                )}
                <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{fmtMom(r.Mom_3m)}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden md:table-cell">{fmtMom(r.Mom_12m)}</td>
                <td className="px-3 py-2 text-right tabular-nums hidden lg:table-cell text-muted-foreground">{fmtVol(r.Volatility_30d)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Format prediction std (raw return space, so ~0.01–0.10 typical). Small σ →
// models agree; large σ → dispersion. Blank when non-ensemble (std = 0).
function fmtStd(v: number | null | undefined): string {
  if (v === undefined || v === null || Number.isNaN(v) || v === 0) return "-";
  return v.toFixed(3);
}

// "3/3" → success, "2/3" → neutral, "1/3" or lower → danger.
function AgreementBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">-</span>;
  const parts = value.split("/");
  const pos = Number(parts[0]);
  const tot = Number(parts[1]);
  if (!Number.isFinite(pos) || !Number.isFinite(tot) || tot === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  const ratio = pos / tot;
  const tone =
    ratio >= 1 ? "border-success/40 bg-success/10 text-success" :
    ratio >= 0.66 ? "border-primary/30 bg-primary/10 text-primary" :
    "border-destructive/30 bg-destructive/10 text-destructive";
  return (
    <span className={cn("inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold", tone)}>
      {value}
    </span>
  );
}

function MonthlyReturnsCard({ dates, values }: { dates: string[]; values: number[] }) {
  // Compute monthly returns from equity curve.
  const monthly: Array<{ month: string; ret: number }> = [];
  for (let i = 1; i < dates.length; i++) {
    const ret = (values[i] / values[i - 1] - 1) * 100;
    monthly.push({ month: dates[i].slice(0, 7), ret });
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">월별 수익률</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1">
          {monthly.slice().reverse().map((m) => (
            <div
              key={m.month}
              className={cn(
                "min-w-[80px] rounded-md border px-2 py-1.5 text-center text-xs",
                m.ret >= 0
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              <div className="text-[10px] text-muted-foreground">{m.month}</div>
              <div className="font-semibold tabular-nums">
                {m.ret >= 0 ? "+" : ""}{m.ret.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HeatmapGrid({ records }: { records: import("@/lib/data").ImportanceRecord[] }) {
  // Top-8 features by mean importance
  const sums = new Map<string, number>();
  for (const r of records) {
    for (const [k, v] of Object.entries(r)) {
      if (k === "date" || typeof v !== "number") continue;
      sums.set(k, (sums.get(k) ?? 0) + v);
    }
  }
  const topFeatures = Array.from(sums.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map((x) => x[0]);
  const maxImp = Math.max(
    ...records.flatMap((r) => topFeatures.map((f) => (typeof r[f] === "number" ? (r[f] as number) : 0))),
  );

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px]">
        <thead>
          <tr>
            <th className="p-1 text-left text-muted-foreground">Feature \ Rebal</th>
            {records.map((r) => (
              <th key={r.date as string} className="p-0.5 text-muted-foreground">
                {(r.date as string).slice(2, 7)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topFeatures.map((f) => (
            <tr key={f}>
              <td className="p-1 pr-2 font-mono text-muted-foreground">{f}</td>
              {records.map((r) => {
                const v = typeof r[f] === "number" ? (r[f] as number) : 0;
                const t = maxImp > 0 ? v / maxImp : 0;
                const alpha = 0.1 + t * 0.85;
                return (
                  <td key={r.date as string} className="p-0.5">
                    <div
                      title={`${f} @ ${(r.date as string).slice(0, 10)}: ${v.toFixed(4)}`}
                      className="h-4 w-4 rounded-sm"
                      style={{ backgroundColor: `rgba(168, 85, 247, ${alpha.toFixed(2)})` }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Helpers ----------

function fmtPct(v: number | undefined | null): string {
  if (v === undefined || v === null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function pos(v: number | undefined | null): "success" | "danger" | "neutral" {
  if (v === undefined || v === null) return "neutral";
  return v >= 0 ? "success" : "danger";
}

function computeIcMean(records: import("@/lib/data").IcRecord[]): number {
  const vals = records.map((r) => r.IC ?? r.IC_RF ?? 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function computeIcStd(records: import("@/lib/data").IcRecord[]): number {
  const vals = records.map((r) => r.IC ?? r.IC_RF ?? 0);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return Math.sqrt(variance);
}

function computeIcPositiveRate(records: import("@/lib/data").IcRecord[]): number {
  const vals = records.map((r) => r.IC ?? r.IC_RF ?? 0);
  const positives = vals.filter((v) => v > 0).length;
  return (positives / vals.length) * 100;
}
