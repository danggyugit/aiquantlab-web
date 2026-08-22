"use client";

import { useState } from "react";
import { Play, Zap } from "lucide-react";
import type { BacktestConfig, BacktestPreset } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_CONFIG, findClosestPreset } from "./preset-matcher";
import { ResultTabs } from "./result-tabs";

const CAP_TIERS = ["Large Cap", "Mid Cap", "Small Cap"];
const SECTORS = [
  "Information Technology",
  "Health Care",
  "Financials",
  "Consumer Discretionary",
  "Communication Services",
  "Industrials",
  "Consumer Staples",
  "Energy",
  "Utilities",
  "Materials",
  "Real Estate",
];
const CASH_STRATEGIES: { value: BacktestConfig["cash_strategy"]; label: string; desc: string }[] = [
  { value: "none", label: "현금 없음", desc: "항상 풀 투자" },
  { value: "vol_target", label: "변동성 목표", desc: "목표 변동성 초과 시 현금 확대" },
  { value: "regime", label: "레짐 기반", desc: "시장 국면에 따라 현금 조절" },
  { value: "combined", label: "결합", desc: "변동성 + 레짐 조합" },
];

type Props = {
  presets: BacktestPreset[];
  presetLoadedInitial?: BacktestPreset;
  apiUrl?: string;         // when set → real backtest execution via FastAPI
  /**
   * If true, hide the strategy config form entirely — preset-loader-only mode.
   * Used on /backtest's AI 앙상블 tab because Render Free's 10-min HTTP
   * timeout means custom-config execution isn't possible there; showing the
   * form would misleadingly imply that it is.
   */
  hideConfig?: boolean;
};

type LoadedState = {
  preset: BacktestPreset;
  exact: boolean;
  source: "preset" | "api";
};

export function Lab({ presets, presetLoadedInitial, apiUrl, hideConfig }: Props) {
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState<LoadedState | null>(
    presetLoadedInitial ? { preset: presetLoadedInitial, exact: true, source: "preset" } : null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCapTier(t: string) {
    setConfig((c) => ({
      ...c,
      cap_tiers: c.cap_tiers.includes(t) ? c.cap_tiers.filter((x) => x !== t) : [...c.cap_tiers, t],
    }));
  }
  function toggleSector(s: string) {
    setConfig((c) => ({
      ...c,
      sectors: c.sectors.includes(s) ? c.sectors.filter((x) => x !== s) : [...c.sectors, s],
    }));
  }

  async function handleRun() {
    setIsRunning(true);
    setError(null);

    // If API URL is configured, run a real backtest on the FastAPI backend.
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl.replace(/\/$/, "")}/backtest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
          // Cold-start requests can take 5-10 min while data is prefetched
          signal: AbortSignal.timeout(15 * 60 * 1000),
        });
        if (!res.ok) {
          throw new Error(`API returned ${res.status}: ${await res.text()}`);
        }
        const preset = (await res.json()) as BacktestPreset;
        setLoaded({ preset, exact: true, source: "api" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`백테스트 API 호출 실패: ${msg}`);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // Fallback: no backend configured → pick the closest precomputed preset.
    setTimeout(() => {
      const match = findClosestPreset(config, presets);
      setLoaded({ preset: match.preset, exact: match.exact, source: "preset" });
      setIsRunning(false);
    }, 30);
  }

  function handleLoadPreset(id: string) {
    const p = presets.find((x) => x.preset_id === id);
    if (!p) return;
    setConfig({ ...p.config });
    setLoaded({ preset: p, exact: true, source: "preset" });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Preset loader — 50 presets grouped by sector */}
      <PresetLoader presets={presets} onLoad={handleLoadPreset} />

      {/* Config form (hidden when hideConfig=true — see Props.hideConfig) */}
      {!hideConfig && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">전략 설정</CardTitle>
          <CardDescription className="text-xs">Universe · 리밸런싱 · 학습 · 가중치 · 현금 전략</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Universe */}
          <section>
            <SectionTitle>Universe</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Cap Tier (다중 선택)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CAP_TIERS.map((t) => (
                    <Chip key={t} selected={config.cap_tiers.includes(t)} onClick={() => toggleCapTier(t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">섹터 (다중 선택)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SECTORS.map((s) => (
                    <Chip key={s} selected={config.sectors.includes(s)} onClick={() => toggleSector(s)}>
                      {s.split(" ")[0]}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Core */}
          <section>
            <SectionTitle>핵심 파라미터</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumField
                label="리밸런싱 주기 (개월)"
                value={config.rebal_m}
                min={1}
                max={12}
                onChange={(v) => setConfig({ ...config, rebal_m: v })}
              />
              <NumField
                label="롤링 학습 (개월)"
                value={config.rolling_w}
                min={2}
                max={24}
                onChange={(v) => setConfig({ ...config, rolling_w: v })}
              />
              <NumField
                label="선정 종목수"
                value={config.n_stocks}
                min={1}
                max={20}
                onChange={(v) => setConfig({ ...config, n_stocks: v })}
              />
            </div>
          </section>

          {/* Date range */}
          <section>
            <SectionTitle>기간</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">시작일</Label>
                <Input
                  type="date"
                  value={config.start.slice(0, 10)}
                  onChange={(e) => setConfig({ ...config, start: `${e.target.value}T00:00:00` })}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">종료일</Label>
                <Input
                  type="date"
                  value={config.end.slice(0, 10)}
                  onChange={(e) => setConfig({ ...config, end: `${e.target.value}T00:00:00` })}
                />
              </div>
            </div>
          </section>

          {/* Strategy toggles */}
          <section>
            <SectionTitle>전략 옵션</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              <ToggleCard
                label="Ensemble 모델"
                desc="RF + XGBoost + LightGBM 3-모델 앙상블"
                checked={config.use_ensemble}
                onChange={(v) => setConfig({ ...config, use_ensemble: v })}
              />
              <ToggleCard
                label="턴오버 버퍼"
                desc="리밸런싱 시 소량 변화는 무시"
                checked={config.use_turnover_buffer}
                onChange={(v) => setConfig({ ...config, use_turnover_buffer: v })}
              />
              <ToggleCard
                label="모멘텀 필터"
                desc="음의 모멘텀 종목 제외"
                checked={config.use_mom_filter}
                onChange={(v) => setConfig({ ...config, use_mom_filter: v })}
              />
              <ToggleCard
                label="역변동성 가중"
                desc="변동성 낮은 종목에 더 많은 비중"
                checked={config.use_inv_vol_weight}
                onChange={(v) => setConfig({ ...config, use_inv_vol_weight: v })}
              />
              <ToggleCard
                label="모멘텀 가중"
                desc="모멘텀 강한 종목에 더 많은 비중"
                checked={config.use_momentum_weight}
                onChange={(v) => setConfig({ ...config, use_momentum_weight: v })}
              />
              <ToggleCard
                label="생존편향 보정"
                desc="상장폐지 종목의 마지막 가격 반영"
                checked={config.use_surv_fix}
                onChange={(v) => setConfig({ ...config, use_surv_fix: v })}
              />
            </div>
          </section>

          {/* Cash strategy */}
          <section>
            <SectionTitle>현금 전략</SectionTitle>
            <Select
              value={config.cash_strategy}
              onValueChange={(v) => setConfig({ ...config, cash_strategy: ((v as string) ?? "none") as BacktestConfig["cash_strategy"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CASH_STRATEGIES.map((cs) => (
                  <SelectItem key={cs.value} value={cs.value}>
                    <span className="font-semibold">{cs.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{cs.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* Advanced */}
          <section>
            <SectionTitle>고급 옵션</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">최소 일 거래대금 ($)</Label>
                <Input
                  type="number"
                  value={config.min_dollar_vol}
                  step={1_000_000}
                  onChange={(e) => setConfig({ ...config, min_dollar_vol: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs text-muted-foreground">거래비용 (%, 왕복)</Label>
                <Input
                  type="number"
                  step={0.05}
                  value={config.tc_pct}
                  onChange={(e) => setConfig({ ...config, tc_pct: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="mt-2">
              <ToggleCard
                label="체결가: 다음날 시가"
                desc="Off = 리밸런싱일 종가로 체결"
                checked={config.use_next_open}
                onChange={(v) => setConfig({ ...config, use_next_open: v })}
              />
            </div>
          </section>

          {/* Run */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-3">
            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">Cap: {config.cap_tiers.join(",") || "-"}</Badge>
              <Badge variant="secondary" className="text-[10px]">Sec: {config.sectors.length}개</Badge>
              <Badge variant="secondary" className="text-[10px]">Top {config.n_stocks} · {config.rebal_m}M</Badge>
              <Badge variant="secondary" className="text-[10px]">Cash: {config.cash_strategy}</Badge>
            </div>
            <Button onClick={handleRun} disabled={isRunning} className="gap-1.5">
              {isRunning ? (
                <>{apiUrl ? "백테스트 실행 중... (최대 10분)" : "계산 중..."}</>
              ) : (
                <>
                  <Play className="h-4 w-4" /> 백테스트 실행
                </>
              )}
            </Button>
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
          {isRunning && apiUrl && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
              첫 요청은 yfinance·SEC 데이터 프리페치 때문에 5-10분 소요. 이후 요청은 캐시로 훨씬 빠릅니다.
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Results */}
      {loaded && <ResultTabs preset={loaded.preset} exact={loaded.exact} source={loaded.source} />}
    </div>
  );
}

// ---------- Sub-components ----------

/**
 * Preset loader — form-style: pick sector + strategy from two dropdowns,
 * then a compact summary card of the selected preset. Scales past 50
 * presets without cluttering the screen.
 */
function PresetLoader({
  presets,
  onLoad,
}: { presets: BacktestPreset[]; onLoad: (id: string) => void }) {
  // Group presets by first sector name
  const groups = new Map<string, BacktestPreset[]>();
  for (const p of presets) {
    const sec = p.config.sectors?.[0] ?? "Unknown";
    if (!groups.has(sec)) groups.set(sec, []);
    groups.get(sec)!.push(p);
  }
  const sectorNames = Array.from(groups.keys()).sort();

  const [sector, setSector] = useState<string>(sectorNames[0] ?? "");
  const activePresets = (groups.get(sector) ?? []).sort(
    (a, b) => (b.summary.cagr_pct ?? 0) - (a.summary.cagr_pct ?? 0),
  );
  const [presetId, setPresetId] = useState<string>(activePresets[0]?.preset_id ?? "");

  // Reset preset selection when sector changes
  function handleSectorChange(next: string) {
    setSector(next);
    const first = (groups.get(next) ?? []).sort(
      (a, b) => (b.summary.cagr_pct ?? 0) - (a.summary.cagr_pct ?? 0),
    )[0];
    setPresetId(first?.preset_id ?? "");
  }

  const selected = activePresets.find((p) => p.preset_id === presetId) ?? activePresets[0];
  const s = selected?.summary;
  const cagr = s?.cagr_pct;
  const cagrColor =
    cagr === undefined ? "text-muted-foreground"
      : cagr >= 20 ? "text-success"
      : cagr >= 0 ? "text-foreground"
      : "text-destructive";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-premium" />
          <CardTitle className="text-base">프리셋 로더</CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {presets.length}개 · {groups.size}개 섹터
          </Badge>
        </div>
        <CardDescription className="text-xs">
          매일 자동 계산되는 백테스트 결과. 섹터 · 전략 선택 → 로드.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_minmax(280px,2fr)]">
          <div className="min-w-0">
            <Label className="mb-1 block text-xs text-muted-foreground">섹터</Label>
            <Select value={sector} onValueChange={(v) => handleSectorChange((v as string) ?? sectorNames[0])}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="w-auto! min-w-[var(--anchor-width)]">
                {sectorNames.map((sec) => (
                  <SelectItem key={sec} value={sec}>
                    <span className="whitespace-nowrap">{sec}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="mb-1 block text-xs text-muted-foreground">
              전략 (CAGR 정렬, {activePresets.length}개)
            </Label>
            <Select
              value={presetId}
              onValueChange={(v) => setPresetId((v as string) ?? "")}
              disabled={activePresets.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="선택하세요" />
              </SelectTrigger>
              <SelectContent className="w-auto! min-w-[var(--anchor-width)] max-w-[min(90vw,520px)]">
                {activePresets.map((p) => (
                  <SelectItem key={p.preset_id} value={p.preset_id}>
                    <span className="whitespace-nowrap">
                      {p.name}{p.summary.cagr_pct !== undefined ? ` · ${p.summary.cagr_pct.toFixed(1)}%` : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selected ? (
          <div className="rounded-lg border border-border/40 bg-card/40 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold">{selected.name}</div>
              <span className={`text-xs font-mono tabular-nums ${cagrColor}`}>
                CAGR {cagr !== undefined ? `${cagr.toFixed(1)}%` : "-"}
              </span>
            </div>
            {selected.description && (
              <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                {selected.description}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span>Sharpe {s?.sharpe?.toFixed(2) ?? "-"}</span>
              <span>MDD {s?.max_dd_pct?.toFixed(1) ?? "-"}%</span>
              <span>변동성 {s?.volatility_pct?.toFixed(1) ?? "-"}%</span>
              <span>승률 {s?.monthly_win_rate_pct?.toFixed(0) ?? "-"}%</span>
            </div>
            <Button
              onClick={() => onLoad(selected.preset_id)}
              size="sm"
              className="mt-3 w-full gap-1.5"
            >
              <Play className="h-3.5 w-3.5" /> 이 프리셋 로드
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/40 p-4 text-center text-xs text-muted-foreground">
            이 섹터의 프리셋이 아직 계산되지 않았습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function Chip({
  children,
  selected,
  onClick,
}: { children: React.ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={
        "rounded-full border px-2.5 py-1 text-xs transition-colors " +
        (selected
          ? "border-primary/60 bg-primary/15 text-primary font-semibold"
          : "border-border/40 text-muted-foreground hover:bg-muted/40")
      }
    >
      {children}
    </button>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
      />
    </div>
  );
}

function ToggleCard({
  label,
  desc,
  checked,
  onChange,
}: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={
      "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors " +
      (checked ? "border-primary/50 bg-primary/5" : "border-border/40 hover:bg-muted/30")
    }>
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <div className="font-semibold text-xs">{label}</div>
        <div className="text-[10px] text-muted-foreground">{desc}</div>
      </div>
    </label>
  );
}
