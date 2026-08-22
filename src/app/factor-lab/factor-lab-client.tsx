"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { BacktestPreset } from "@/lib/data";
import { FactorEquityChart, type EquityPoint } from "./factor-equity-chart";

// ── Full strategy registry mirroring streamlit_app/services/factor_strategies.py ──

type StrategyMeta = {
  key: string;
  name: string;
  short: string;
  long?: string;
  category: "price" | "fundamentals" | "hybrid";
};

export const STRATEGIES: StrategyMeta[] = [
  // Price-based
  { key: "momentum_12m", name: "12개월 모멘텀", short: "지난 12개월 수익률 상위 종목", category: "price",
    long: "최근 12개월 동안 가장 많이 오른 종목을 보유하는 전략입니다. 단기 평균회귀(t-1월)를 포함한 원시 12개월 수익률 기준." },
  { key: "momentum_3_12m", name: "3-12개월 모멘텀", short: "12개월 수익률 – 최근 1개월 (단기 반전 제거)", category: "price",
    long: "Jegadeesh-Titman 방식. 최근 1개월의 단기 반전을 제거해 순수 중기 모멘텀만 포착." },
  { key: "low_volatility", name: "로우볼", short: "변동성 낮은 종목 보유", category: "price",
    long: "학술적으로 리스크 대비 수익률이 뛰어난 저변동성 종목 프리미엄을 활용." },
  { key: "mean_reversion_1m", name: "단기 평균회귀", short: "최근 1개월 하락 폭이 큰 종목 매수 (역발상)", category: "price" },
  { key: "high_52w", name: "52주 신고가 근접", short: "12개월 최고가에 가까운 종목 (강세 지속)", category: "price" },
  { key: "risk_adj_momentum", name: "리스크조정 모멘텀", short: "변동성 대비 12개월 수익률 상위", category: "price" },
  { key: "momentum_lowvol", name: "모멘텀 × 로우볼", short: "모멘텀 상위 + 저변동성 결합", category: "price" },
  { key: "dual_momentum", name: "듀얼 모멘텀", short: "모멘텀 상위 + 절대수익 음수면 현금 보유", category: "price" },
  // Fundamentals
  { key: "low_per", name: "저PER", short: "PER 하위 종목 (저평가 대형주)", category: "fundamentals" },
  { key: "high_roe", name: "고ROE", short: "자기자본이익률 상위 종목 (퀄리티)", category: "fundamentals" },
  { key: "magic_formula", name: "Magic Formula (변형)", short: "저PER × 고ROE — Greenblatt 아이디어 변형", category: "fundamentals",
    long: "Joel Greenblatt의 Magic Formula를 PER·ROE 조합으로 간소화." },
  { key: "magic_formula_ev", name: "Magic Formula (정통)", short: "EBIT/EV 수익수익률 + ROIC (Greenblatt 원전)", category: "fundamentals" },
  { key: "deep_value", name: "딥밸류", short: "저PBR × 저PSR (심리적 저평가주)", category: "fundamentals" },
  { key: "value_composite", name: "밸류 컴포지트", short: "PER·PBR·PSR 종합 저평가", category: "fundamentals" },
  { key: "eps_growth", name: "EPS 성장", short: "연간 EPS 성장률 상위 (성장주)", category: "fundamentals" },
  { key: "garp", name: "GARP (합리가격 성장)", short: "저PER + EPS 성장 결합", category: "fundamentals" },
  { key: "margin_trend", name: "마진 개선", short: "순이익률 YoY 개선 상위", category: "fundamentals" },
  { key: "mini_fscore", name: "미니 F-Score", short: "Piotroski 간소화 퀄리티 스코어 (0~4점)", category: "fundamentals" },
  { key: "quality_low_debt", name: "퀄리티 + 저부채", short: "고ROE + 낮은 부채비율", category: "fundamentals" },
  { key: "high_div_safe", name: "안전 고배당", short: "고배당 + 저부채 (배당 지속 가능성)", category: "fundamentals" },
  { key: "low_pbr_high_div", name: "저PBR 고배당", short: "순자산 대비 싸고 배당 주는 종목", category: "fundamentals" },
  { key: "shareholder_yield", name: "주주환원 수익률", short: "배당 + 자사주매입 총 주주환원 상위", category: "fundamentals" },
  { key: "buyback_yield", name: "자사주 매입", short: "발행주식수 감소율 상위 (바이백)", category: "fundamentals" },
];

const REBAL_OPTS = [
  { value: 1, label: "월별" },
  { value: 3, label: "분기" },
  { value: 6, label: "반기" },
  { value: 12, label: "연간" },
];

const CAP_OPTS = ["전체", "Large Cap", "Mid Cap", "Small Cap"];

const CATEGORY_LABEL: Record<StrategyMeta["category"], string> = {
  price: "가격",
  fundamentals: "펀더멘털",
  hybrid: "복합",
};
const CATEGORY_COLOR: Record<StrategyMeta["category"], string> = {
  price: "bg-success/20 text-success",
  fundamentals: "bg-primary/15 text-primary",
  hybrid: "bg-premium/20 text-premium",
};

type FormState = {
  strategy: string;
  startDate: string;
  endDate: string;
  rebalance: number;
  nStocks: string;
  tc: string;
  sector: string;
  cap: string;
};

// Response shape from POST /factor-backtest — matches FactorBacktestResult in
// api/factor_backtest.py.
type FactorBacktestResponse = {
  strategy_name: string;
  strategy_category: string;
  equity_curve: EquityPoint[];
  rebalance_history: Array<{
    date: string;
    period_return_pct: number;
    portfolio_equity: number;
    picks: string[];
    n_picks: number;
  }>;
  metrics: {
    total_return_pct?: number;
    cagr_pct?: number;
    sharpe?: number;
    volatility_pct?: number;
    max_drawdown_pct?: number;
    period_win_rate_pct?: number;
  };
  benchmark_metrics: Record<string, Record<string, number>>;
  universe_size: number;
  final_picks: string[];
  final_picks_date: string | null;
  warnings: string[];
};

const today = new Date();
const defaultStart = new Date(2023, 0, 1);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function runFactorBacktest(apiUrl: string, req: {
  strategy_key: string;
  start_date: string;
  end_date: string;
  rebalance_months: number;
  n_stocks: number;
  tc_pct: number;
  sector: string | null;
  cap_tier: string | null;
}): Promise<FactorBacktestResponse> {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/factor-backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal: AbortSignal.timeout(3 * 60 * 1000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

export function FactorLabClient({
  presets,
  sectors,
  apiUrl,
}: { presets: BacktestPreset[]; sectors: string[]; apiUrl?: string }) {
  return (
    <Tabs defaultValue="single">
      <TabsList className="flex flex-wrap gap-1 bg-transparent p-0">
        <TabsTrigger value="single" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          🎯 단일 전략
        </TabsTrigger>
        <TabsTrigger value="compare" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          🔀 전략 비교
        </TabsTrigger>
        <TabsTrigger value="guide" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          📖 전략 설명
        </TabsTrigger>
      </TabsList>

      <TabsContent value="single" className="mt-4">
        <SingleTab sectors={sectors} presets={presets} apiUrl={apiUrl} />
      </TabsContent>

      <TabsContent value="compare" className="mt-4">
        <CompareTab sectors={sectors} apiUrl={apiUrl} />
      </TabsContent>

      <TabsContent value="guide" className="mt-4">
        <GuideTab />
      </TabsContent>
    </Tabs>
  );
}

// ─────────────── Tab 1: Single Strategy ───────────────

function SingleTab({ sectors, apiUrl }: { sectors: string[]; presets: BacktestPreset[]; apiUrl?: string }) {
  const [form, setForm] = useState<FormState>({
    strategy: "momentum_12m",
    startDate: isoDate(defaultStart),
    endDate: isoDate(today),
    rebalance: 1,
    nStocks: "5",
    tc: "0.30",
    sector: "전체",
    cap: "전체",
  });
  const [result, setResult] = useState<FactorBacktestResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = STRATEGIES.find((s) => s.key === form.strategy);

  async function handleRun() {
    if (!apiUrl) {
      setError("백엔드 API가 설정되지 않았습니다. .env.local에 NEXT_PUBLIC_API_URL을 설정하세요.");
      return;
    }
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await runFactorBacktest(apiUrl, {
        strategy_key: form.strategy,
        start_date: form.startDate,
        end_date: form.endDate,
        rebalance_months: form.rebalance,
        n_stocks: parseInt(form.nStocks) || 5,
        tc_pct: parseFloat(form.tc) || 0.3,
        sector: form.sector === "전체" ? null : form.sector,
        cap_tier: form.cap === "전체" ? null : form.cap,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">백테스트 설정</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Row 1: Strategy + category */}
          <div className="grid gap-3 sm:grid-cols-[3fr_2fr]">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">전략</Label>
              <Select value={form.strategy} onValueChange={(v) => setForm({ ...form, strategy: (v as string) ?? "momentum_12m" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.name} ({s.short})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              {selected && (
                <div className="text-xs text-muted-foreground">
                  {selected.category === "price"
                    ? "🟢 가격 기반 · 장기 백테스트 가능"
                    : "🔵 펀더멘털 PIT · 최대 4년 권장 (yfinance 연간 데이터 한도)"}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Date range + rebalance */}
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">백테스트 기간</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">리밸런싱</Label>
              <Select value={String(form.rebalance)} onValueChange={(v) => setForm({ ...form, rebalance: parseInt((v as string) ?? "1") })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REBAL_OPTS.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: n_stocks + tc + sector + cap */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">보유 종목 수</Label>
              <Input type="number" min={3} max={100} value={form.nStocks} onChange={(e) => setForm({ ...form, nStocks: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">거래비용 (%)</Label>
              <Input type="number" step={0.05} value={form.tc} onChange={(e) => setForm({ ...form, tc: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">섹터 필터</Label>
              <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: (v as string) ?? "전체" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="전체">전체</SelectItem>
                  {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">시총 구간</Label>
              <Select value={form.cap} onValueChange={(v) => setForm({ ...form, cap: (v as string) ?? "전체" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAP_OPTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleRun} disabled={isRunning} className="gap-1.5">
            {isRunning ? <><Loader2 className="h-4 w-4 animate-spin" /> 백테스트 실행 중...</> : <><Play className="h-4 w-4" /> 백테스트 실행</>}
          </Button>
          {isRunning && (
            <div className="text-xs text-muted-foreground">
              Render 서버가 콜드 스타트 상태이면 최초 요청은 1-2분 정도 소요될 수 있습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mr-1 inline h-3 w-3" />
          <strong>에러:</strong> {error}
        </div>
      )}

      {result && <SingleResult data={result} />}
    </div>
  );
}

function SingleResult({ data }: { data: FactorBacktestResponse }) {
  const m = data.metrics;
  const spy = data.benchmark_metrics.SPY ?? {};
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{data.strategy_name}</CardTitle>
              <CardDescription className="text-xs">
                유니버스 {data.universe_size}종목 · 리밸런싱 {data.rebalance_history.length}회
                {data.final_picks_date && ` · 최종 리밸런스 ${data.final_picks_date}`}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {data.strategy_category === "price" ? "가격" : data.strategy_category === "fundamentals" ? "펀더멘털" : "복합"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Metric label="누적 수익률" value={fmtPct(m.total_return_pct)} tone={tone(m.total_return_pct)} />
            <Metric label="CAGR" value={fmtPct(m.cagr_pct)} tone={tone(m.cagr_pct)} />
            <Metric label="Sharpe" value={m.sharpe?.toFixed(2) ?? "-"} tone={(m.sharpe ?? 0) > 1 ? "success" : "neutral"} />
            <Metric label="변동성" value={fmtPct(m.volatility_pct, false)} />
            <Metric label="최대 낙폭" value={fmtPct(m.max_drawdown_pct, false)} tone={(m.max_drawdown_pct ?? 0) > -20 ? "success" : "danger"} />
            <Metric label="승률" value={fmtPct(m.period_win_rate_pct, false)} />
          </div>

          {data.equity_curve.length > 1 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">누적 수익 곡선 (SPY 대비)</div>
              <FactorEquityChart data={data.equity_curve} />
              {spy.cagr_pct !== undefined && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  SPY 벤치마크 — CAGR {fmtPct(spy.cagr_pct)} · Sharpe {spy.sharpe?.toFixed(2) ?? "-"} · MDD {fmtPct(spy.max_drawdown_pct, false)}
                </div>
              )}
            </div>
          )}

          {data.final_picks.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted-foreground">최종 편입 종목</div>
              <div className="flex flex-wrap gap-1.5">
                {data.final_picks.map((t) => (
                  <Badge key={t} variant="secondary" className="font-mono">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {data.rebalance_history.length > 0 && (
            <details>
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground">
                리밸런싱 이력 ({data.rebalance_history.length}회)
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border/60 bg-muted/20 text-left text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5">일자</th>
                      <th className="px-2 py-1.5 text-right">기간 수익률</th>
                      <th className="px-2 py-1.5 text-right">누적</th>
                      <th className="px-2 py-1.5">편입 종목</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rebalance_history.map((r) => (
                      <tr key={r.date} className="border-b border-border/30">
                        <td className="px-2 py-1.5 font-mono">{r.date}</td>
                        <td className={cn(
                          "px-2 py-1.5 text-right tabular-nums",
                          r.period_return_pct >= 0 ? "text-success" : "text-destructive",
                        )}>
                          {r.period_return_pct >= 0 ? "+" : ""}{r.period_return_pct.toFixed(2)}%
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.portfolio_equity.toFixed(3)}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{r.picks.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {data.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-100/90">
              {data.warnings.map((w, i) => (
                <div key={i}>⚠️ {w}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────── Tab 2: Compare Strategies ───────────────

function CompareTab({ sectors, apiUrl }: { sectors: string[]; apiUrl?: string }) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["momentum_12m", "low_volatility", "magic_formula"]);
  const [form, setForm] = useState({
    startDate: isoDate(defaultStart),
    endDate: isoDate(today),
    rebalance: 1,
    nStocks: "5",
    tc: "0.30",
    sector: "전체",
    cap: "전체",
  });
  const [results, setResults] = useState<Array<{ key: string; data?: FactorBacktestResponse; error?: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    if (selectedKeys.includes(key)) {
      setSelectedKeys(selectedKeys.filter((k) => k !== key));
    } else if (selectedKeys.length < 5) {
      setSelectedKeys([...selectedKeys, key]);
    }
  }

  async function handleRun() {
    if (!apiUrl) {
      setError("백엔드 API가 설정되지 않았습니다.");
      return;
    }
    setIsRunning(true);
    setError(null);
    setResults([]);

    const promises = selectedKeys.map(async (key) => {
      try {
        const data = await runFactorBacktest(apiUrl, {
          strategy_key: key,
          start_date: form.startDate,
          end_date: form.endDate,
          rebalance_months: form.rebalance,
          n_stocks: parseInt(form.nStocks) || 5,
          tc_pct: parseFloat(form.tc) || 0.3,
          sector: form.sector === "전체" ? null : form.sector,
          cap_tier: form.cap === "전체" ? null : form.cap,
        });
        return { key, data };
      } catch (e) {
        return { key, error: e instanceof Error ? e.message : String(e) };
      }
    });
    const settled = await Promise.all(promises);
    setResults(settled);
    setIsRunning(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">복수 전략 비교</CardTitle>
          <CardDescription className="text-xs">
            최대 5개 전략을 같은 조건으로 병렬 백테스트
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">
              비교할 전략 (최대 5개, 현재 {selectedKeys.length}개)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {STRATEGIES.map((s) => {
                const on = selectedKeys.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => toggle(s.key)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      on
                        ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                        : "border-border/40 text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">백테스트 기간</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">리밸런싱</Label>
              <Select value={String(form.rebalance)} onValueChange={(v) => setForm({ ...form, rebalance: parseInt((v as string) ?? "1") })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REBAL_OPTS.map((r) => <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">보유 종목</Label>
              <Input type="number" min={3} max={100} value={form.nStocks} onChange={(e) => setForm({ ...form, nStocks: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">거래비용 (%)</Label>
              <Input type="number" step={0.05} value={form.tc} onChange={(e) => setForm({ ...form, tc: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">섹터 필터</Label>
              <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: (v as string) ?? "전체" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="전체">전체</SelectItem>
                  {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">시총 구간</Label>
              <Select value={form.cap} onValueChange={(v) => setForm({ ...form, cap: (v as string) ?? "전체" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAP_OPTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleRun} disabled={isRunning || selectedKeys.length === 0} className="gap-1.5">
            {isRunning ? <><Loader2 className="h-4 w-4 animate-spin" /> 실행 중...</> : <><Play className="h-4 w-4" /> 비교 실행</>}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mr-1 inline h-3 w-3" />
          <strong>에러:</strong> {error}
        </div>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">비교 결과</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">전략</th>
                  <th className="px-3 py-2 text-right">누적</th>
                  <th className="px-3 py-2 text-right">CAGR</th>
                  <th className="px-3 py-2 text-right">Sharpe</th>
                  <th className="px-3 py-2 text-right">MDD</th>
                  <th className="px-3 py-2 text-right">변동성</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => {
                  const meta = STRATEGIES.find((s) => s.key === r.key);
                  if (r.error) {
                    return (
                      <tr key={r.key} className="border-b border-border/30">
                        <td className="px-3 py-2 font-semibold">{meta?.name ?? r.key}</td>
                        <td colSpan={5} className="px-3 py-2 text-xs text-destructive">에러: {r.error}</td>
                      </tr>
                    );
                  }
                  const m = r.data!.metrics;
                  return (
                    <tr key={r.key} className="border-b border-border/30">
                      <td className="px-3 py-2 font-semibold">{meta?.name ?? r.key}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", (m.total_return_pct ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                        {fmtPct(m.total_return_pct)}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", (m.cagr_pct ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                        {fmtPct(m.cagr_pct)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.sharpe?.toFixed(2) ?? "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-destructive">{fmtPct(m.max_drawdown_pct, false)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(m.volatility_pct, false)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────── Tab 3: Strategy Guide ───────────────

function GuideTab() {
  const price = STRATEGIES.filter((s) => s.category === "price");
  const fund = STRATEGIES.filter((s) => s.category === "fundamentals");

  return (
    <div className="flex flex-col gap-6">
      <StrategyGroup title="🟢 가격 기반 전략 (Price-based)" strategies={price} />
      <StrategyGroup title="🔵 펀더멘털 전략 (Fundamentals)" strategies={fund} />

      <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground">
        <div className="mb-1 font-semibold text-foreground">📌 전략 선택 팁</div>
        <ul className="space-y-1">
          <li>• <strong className="text-foreground">가격 기반</strong>: yfinance 일봉만 필요 → 장기 백테스트 (15년+) 가능</li>
          <li>• <strong className="text-foreground">펀더멘털</strong>: PIT 재무 필요 → SEC EDGAR + 캐시 필요, 4년 권장</li>
          <li>• <strong className="text-foreground">모멘텀 vs 로우볼</strong>: 상승장 = 모멘텀, 하락장 = 로우볼 유리</li>
          <li>• <strong className="text-foreground">가치 vs 성장</strong>: 금리 사이클과 반대. 저금리 = 성장, 고금리 = 가치</li>
        </ul>
      </div>
    </div>
  );
}

function StrategyGroup({ title, strategies }: { title: string; strategies: StrategyMeta[] }) {
  return (
    <section>
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {strategies.map((s) => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{s.name}</CardTitle>
                <Badge variant="secondary" className={cn("text-[10px]", CATEGORY_COLOR[s.category])}>
                  {CATEGORY_LABEL[s.category]}
                </Badge>
              </div>
              <CardDescription className="text-xs">{s.short}</CardDescription>
            </CardHeader>
            {s.long && (
              <CardContent className="pt-0 text-xs text-muted-foreground">{s.long}</CardContent>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

// ─────────────── Utility ───────────────

function fmtPct(v: number | undefined, withSign = true): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "-";
  const sign = withSign && v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

function tone(v: number | undefined): "success" | "danger" | "neutral" {
  if (v === undefined || v === null) return "neutral";
  return v >= 0 ? "success" : "danger";
}

function Metric({
  label,
  value,
  tone,
}: { label: string; value: string; tone?: "success" | "danger" | "neutral" }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}
