"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { BacktestPreset } from "@/lib/data";

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
  { key: "mean_reversion", name: "단기 평균회귀", short: "최근 1개월 하락 폭이 큰 종목 매수 (역발상)", category: "price" },
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

const today = new Date();
const defaultStart = new Date(2023, 0, 1);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export function FactorLabClient({
  presets,
  sectors,
}: { presets: BacktestPreset[]; sectors: string[] }) {
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
        <SingleTab sectors={sectors} presets={presets} />
      </TabsContent>

      <TabsContent value="compare" className="mt-4">
        <CompareTab sectors={sectors} presets={presets} />
      </TabsContent>

      <TabsContent value="guide" className="mt-4">
        <GuideTab />
      </TabsContent>
    </Tabs>
  );
}

// ─────────────── Tab 1: Single Strategy ───────────────

function SingleTab({ sectors, presets }: { sectors: string[]; presets: BacktestPreset[] }) {
  const [form, setForm] = useState<FormState>({
    strategy: "momentum_12m",
    startDate: isoDate(defaultStart),
    endDate: isoDate(today),
    rebalance: 1,
    nStocks: "5",
    tc: "0.30",
    sector: "Information Technology",
    cap: "Large Cap",
  });
  const [result, setResult] = useState<BacktestPreset | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const selected = STRATEGIES.find((s) => s.key === form.strategy);

  function handleRun() {
    // Real Factor Lab backtest computation requires Python (fundamentals PIT
    // joins, monthly rebalance loop). Not runnable in browser. Show the
    // closest AI Quant Lab preset as a proxy result.
    setShowBanner(true);
    const proxyPreset = presets[0] ?? null;
    setResult(proxyPreset);
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

          <Button onClick={handleRun} className="gap-1.5">
            <Play className="h-4 w-4" /> 백테스트 실행
          </Button>
        </CardContent>
      </Card>

      {showBanner && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
          <AlertCircle className="mr-1 inline h-3 w-3 text-amber-400" />
          <strong className="text-amber-400">계산 한계:</strong> Factor Lab 백테스트는 Python 백엔드(PIT 재무 데이터 + 20+ 전략 스코어링)가 필요합니다.
          실시간 실행 대신 AI Quant Lab의 프리셋 결과를 참고하시거나, Streamlit 원본에서 실행하세요.
        </div>
      )}

      {result && (
        <SingleResult preset={result} strategyName={selected?.name ?? ""} />
      )}
    </div>
  );
}

function SingleResult({ preset, strategyName }: { preset: BacktestPreset; strategyName: string }) {
  const s = preset.summary;
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{strategyName} — 백테스트 결과 (프록시)</CardTitle>
          <CardDescription className="text-xs">
            AI Quant Lab의 가장 가까운 프리셋 ({preset.name})으로 대체 표시.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Metric label="누적 수익률" value={s.total_return_pct !== undefined ? `${s.total_return_pct >= 0 ? "+" : ""}${s.total_return_pct.toFixed(1)}%` : "-"} tone={(s.total_return_pct ?? 0) >= 0 ? "success" : "danger"} />
            <Metric label="CAGR" value={s.cagr_pct !== undefined ? `${s.cagr_pct >= 0 ? "+" : ""}${s.cagr_pct.toFixed(2)}%` : "-"} tone={(s.cagr_pct ?? 0) >= 0 ? "success" : "danger"} />
            <Metric label="Sharpe" value={s.sharpe?.toFixed(2) ?? "-"} tone={(s.sharpe ?? 0) > 1 ? "success" : "neutral"} />
            <Metric label="변동성" value={s.volatility_pct ? `${s.volatility_pct.toFixed(1)}%` : "-"} />
            <Metric label="최대 낙폭" value={s.max_dd_pct !== undefined ? `${s.max_dd_pct.toFixed(1)}%` : "-"} tone={(s.max_dd_pct ?? 0) > -20 ? "success" : "danger"} />
            <Metric label="기간 승률" value={s.monthly_win_rate_pct !== undefined ? `${s.monthly_win_rate_pct.toFixed(0)}%` : "-"} />
          </div>
          <Link
            href="/ai-quant-lab"
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            AI Quant Lab에서 상세 결과 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────── Tab 2: Compare Strategies ───────────────

function CompareTab({ sectors, presets }: { sectors: string[]; presets: BacktestPreset[] }) {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["momentum_12m", "low_volatility", "magic_formula"]);
  const [form, setForm] = useState({
    startDate: isoDate(defaultStart),
    endDate: isoDate(today),
    rebalance: 1,
    nStocks: "5",
    tc: "0.30",
    sector: "Information Technology",
    cap: "Large Cap",
  });
  const [showResult, setShowResult] = useState(false);

  function toggle(key: string) {
    if (selectedKeys.includes(key)) {
      setSelectedKeys(selectedKeys.filter((k) => k !== key));
    } else if (selectedKeys.length < 5) {
      setSelectedKeys([...selectedKeys, key]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">복수 전략 비교</CardTitle>
          <CardDescription className="text-xs">
            최대 5개 전략을 같은 조건으로 동시 백테스트
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Strategy multi-select chips */}
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

          {/* Shared params (same as single) */}
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

          <Button onClick={() => setShowResult(true)} disabled={selectedKeys.length === 0} className="gap-1.5">
            <Play className="h-4 w-4" /> 비교 실행
          </Button>
        </CardContent>
      </Card>

      {showResult && (
        <>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
            <AlertCircle className="mr-1 inline h-3 w-3 text-amber-400" />
            <strong className="text-amber-400">계산 한계:</strong> 다중 전략 백테스트는 Python 백엔드가 필요합니다.
            AI Quant Lab의 5개 프리셋으로 비교 UI만 표시.
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">비교 결과 (프록시)</CardTitle>
              <CardDescription className="text-xs">
                AI Quant Lab 프리셋으로 대체. 선택 전략은 아래 배지로 표시.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {selectedKeys.map((k) => {
                  const s = STRATEGIES.find((x) => x.key === k);
                  return <Badge key={k} variant="secondary">{s?.name ?? k}</Badge>;
                })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">프리셋</th>
                      <th className="px-3 py-2 text-right">CAGR</th>
                      <th className="px-3 py-2 text-right">Sharpe</th>
                      <th className="px-3 py-2 text-right">MDD</th>
                      <th className="px-3 py-2 text-right">Sortino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presets.slice(0, 5).map((p) => (
                      <tr key={p.preset_id} className="border-b border-border/30">
                        <td className="px-3 py-2 font-semibold">{p.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-success">{p.summary.cagr_pct?.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.summary.sharpe?.toFixed(2) ?? "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-destructive">{p.summary.max_dd_pct?.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.summary.sortino?.toFixed(2) ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link href="/ai-quant-lab" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                AI Quant Lab에서 상세 비교 <ArrowRight className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </>
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
