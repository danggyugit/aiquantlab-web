"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketSnapshot } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { classifyPattern } from "@/app/rs-screener/rs-client";

export type TickerRow = {
  ticker: string;
  name: string;
  sector: string;
  industry: string | null;
  capTier: string;
  marketCap: number;
  price: number | null;
  changePct: number | null;
  returns: Record<string, number | null | undefined>;
  fiftyTwoWkHigh: number | null;
  fiftyTwoWkLow: number | null;
  distFromHigh: number | null;
  upDaysRatio: number;
  avgVolume: number | null;
  lastVolume: number;
};

const PERIOD = "3m"; // anchor period for all levels

// ═══════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════

export function TopDownWorkflow({
  snapshot,
  rows,
}: {
  snapshot: MarketSnapshot;
  rows: TickerRow[];
}) {
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  // Reset downstream selections when upstream changes
  function pickSector(s: string) {
    setSelectedSector(s);
    setSelectedIndustry(null);
    setSelectedTicker(null);
  }
  function pickIndustry(i: string) {
    setSelectedIndustry(i);
    setSelectedTicker(null);
  }

  const regime = useMemo(() => computeRegime(snapshot), [snapshot]);
  const spy3m = getNum(snapshot.spy_returns?.["3m"]);

  const sectorRows = useMemo(() => aggregateBy(rows, (r) => r.sector, spy3m), [rows, spy3m]);
  const industryRows = useMemo(() => {
    if (!selectedSector) return [];
    return aggregateBy(
      rows.filter((r) => r.sector === selectedSector),
      (r) => r.industry,
      spy3m,
    );
  }, [rows, selectedSector, spy3m]);

  const stockRows = useMemo(() => {
    if (!selectedSector || !selectedIndustry) return [];
    return rows
      .filter((r) => r.sector === selectedSector && r.industry === selectedIndustry)
      .map((r) => {
        const ex3m = num(r.returns["3m"]) !== null ? num(r.returns["3m"])! - spy3m : null;
        const ex1m = excessVsSpy(r, snapshot, "1m");
        const ex6m = excessVsSpy(r, snapshot, "6m");
        const ex12m = excessVsSpy(r, snapshot, "1y");
        return {
          row: r,
          ex1m, ex3m, ex6m, ex12m,
          pattern: classifyPattern(ex1m, ex3m, ex6m),
        };
      })
      .sort((a, b) => (b.ex3m ?? -Infinity) - (a.ex3m ?? -Infinity));
  }, [rows, selectedSector, selectedIndustry, snapshot, spy3m]);

  const selectedTickerRow = useMemo(
    () => (selectedTicker ? stockRows.find((s) => s.row.ticker === selectedTicker) : null),
    [selectedTicker, stockRows],
  );

  return (
    <div className="flex flex-col gap-4">
      <Step number={1} title="시장 Regime" completed={regime.verdict !== "no-go"}>
        <RegimePanel snapshot={snapshot} regime={regime} />
      </Step>

      <Step number={2} title="섹터 RS 랭킹" completed={!!selectedSector} disabled={regime.verdict === "no-go"}>
        {regime.verdict === "no-go" ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            🔴 시장 Regime이 위험 상태입니다. 신규 매수 진입을 재고하세요.
            그래도 진행하려면 아래에서 섹터를 선택하세요.
          </div>
        ) : null}
        <SectorPanel
          rows={sectorRows}
          selected={selectedSector}
          onPick={pickSector}
          spy3m={spy3m}
        />
      </Step>

      <Step number={3} title={selectedSector ? `산업 드릴다운: ${selectedSector}` : "산업 드릴다운"} completed={!!selectedIndustry} disabled={!selectedSector}>
        {!selectedSector ? (
          <EmptyHint msg="Step 2에서 섹터를 먼저 선택하세요" />
        ) : (
          <IndustryPanel rows={industryRows} selected={selectedIndustry} onPick={pickIndustry} />
        )}
      </Step>

      <Step
        number={4}
        title={selectedIndustry ? `종목 RS + Pattern: ${selectedIndustry}` : "종목 RS + Pattern"}
        completed={!!selectedTicker}
        disabled={!selectedIndustry}
      >
        {!selectedIndustry ? (
          <EmptyHint msg="Step 3에서 산업을 먼저 선택하세요" />
        ) : (
          <StockPanel
            rows={stockRows}
            selected={selectedTicker}
            onPick={setSelectedTicker}
          />
        )}
      </Step>

      <Step number={5} title={selectedTicker ? `가격 구조 · 진입 시점: ${selectedTicker}` : "가격 구조 · 진입 시점"} completed={false} disabled={!selectedTicker}>
        {!selectedTicker || !selectedTickerRow ? (
          <EmptyHint msg="Step 4에서 종목을 먼저 선택하세요" />
        ) : (
          <StructurePanel item={selectedTickerRow} />
        )}
      </Step>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Step wrapper
// ═══════════════════════════════════════════════════════════════

function Step({
  number,
  title,
  completed,
  disabled,
  children,
}: {
  number: number;
  title: string;
  completed: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className={cn(disabled && "opacity-60")}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-6 py-4 text-left"
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            completed ? "bg-success text-background" : disabled ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary",
          )}
        >
          {completed ? <Check className="h-4 w-4" /> : number}
        </span>
        <span className="flex-1 text-base font-semibold">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

function EmptyHint({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/40 p-4 text-center text-xs text-muted-foreground">
      {msg}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Step 1: Market Regime
// ═══════════════════════════════════════════════════════════════

type Regime = {
  verdict: "go" | "caution" | "no-go";
  bullets: Array<{ label: string; value: string; ok: boolean }>;
  message: string;
};

function computeRegime(s: MarketSnapshot): Regime {
  const spyAbove200 = s.breadth.above_pct > 0;
  const breadthOk = s.breadth.above_pct >= 0; // spy above sma200 → positive number
  const breadthStrong = s.breadth.above_pct >= 5;
  const vixCalm = s.vix.current < 20;
  const vixOk = s.vix.current < 25;
  const fg = s.fear_greed?.score ?? 50;
  const fgOk = fg >= 40; // not in fear territory

  const bullets = [
    { label: "SPY vs 200MA", value: `${s.breadth.above_pct >= 0 ? "+" : ""}${s.breadth.above_pct.toFixed(1)}%`, ok: spyAbove200 },
    { label: "VIX", value: s.vix.current.toFixed(1), ok: vixOk },
    { label: "Fear & Greed", value: String(Math.round(fg)), ok: fgOk },
    { label: "시장 폭 (>200MA 종목)", value: `${s.breadth.above_pct.toFixed(1)}%`, ok: breadthOk },
  ];
  const okCount = bullets.filter((b) => b.ok).length;

  let verdict: Regime["verdict"];
  let message: string;
  if (okCount >= 3 && breadthStrong && vixCalm) {
    verdict = "go";
    message = "🟢 GO — 시장 환경 우호적. 개별 종목 롱 진입 적극 고려.";
  } else if (okCount <= 1) {
    verdict = "no-go";
    message = "🔴 NO-GO — 시장 환경 부담. 현금 비중 확대, 신규 매수 유보.";
  } else {
    verdict = "caution";
    message = "🟡 CAUTION — 혼조 신호. 최상위 후보만 소량 진입, 손절 타이트하게.";
  }
  return { verdict, bullets, message };
}

function RegimePanel({ snapshot, regime }: { snapshot: MarketSnapshot; regime: Regime }) {
  const verdictColor =
    regime.verdict === "go" ? "border-success/30 bg-success/5 text-success"
    : regime.verdict === "no-go" ? "border-destructive/30 bg-destructive/5 text-destructive"
    : "border-amber-500/30 bg-amber-500/5 text-amber-400";

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("rounded-lg border p-4 text-sm font-semibold", verdictColor)}>
        {regime.message}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {regime.bullets.map((b) => (
          <div
            key={b.label}
            className={cn(
              "rounded-lg border p-3",
              b.ok ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5",
            )}
          >
            <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {b.label}
            </div>
            <div className={cn("mt-1 text-lg font-bold tabular-nums", b.ok ? "text-success" : "text-destructive")}>
              {b.value}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        VIX {snapshot.vix.current.toFixed(1)} · SPY ${snapshot.breadth.spy_close.toFixed(0)} vs 200MA ${snapshot.breadth.sma200.toFixed(0)}
        {snapshot.fear_greed && ` · F&G ${snapshot.fear_greed.label}`}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Step 2: Sector RS
// ═══════════════════════════════════════════════════════════════

type AggRow = {
  key: string;
  count: number;
  totalCap: number;
  wAvg: number;      // weighted 3m return
  excess: number;    // wAvg - spy 3m
};

function aggregateBy(rows: TickerRow[], keyOf: (r: TickerRow) => string | null, spy3m: number): AggRow[] {
  const map = new Map<string, { totalCap: number; weightedChange: number; count: number }>();
  for (const r of rows) {
    const key = keyOf(r);
    const ret = num(r.returns[PERIOD]);
    if (!key || ret === null) continue;
    let e = map.get(key);
    if (!e) { e = { totalCap: 0, weightedChange: 0, count: 0 }; map.set(key, e); }
    e.totalCap += r.marketCap;
    e.weightedChange += r.marketCap * ret;
    e.count += 1;
  }
  return Array.from(map.entries())
    .map(([key, e]) => {
      const wAvg = e.totalCap > 0 ? e.weightedChange / e.totalCap : 0;
      return { key, count: e.count, totalCap: e.totalCap, wAvg, excess: wAvg - spy3m };
    })
    .sort((a, b) => b.excess - a.excess);
}

function SectorPanel({
  rows,
  selected,
  onPick,
  spy3m,
}: {
  rows: AggRow[];
  selected: string | null;
  onPick: (s: string) => void;
  spy3m: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        3M 시가총액 가중 평균 · SPY 대비 excess return · 강한 순 정렬 · SPY 3M: {spy3m >= 0 ? "+" : ""}{spy3m.toFixed(2)}%
      </p>
      <div className="overflow-x-auto rounded-lg border border-border/40">
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-14" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-[72px]" />
          </colgroup>
          <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Sector</th>
              <th className="px-2 py-2 text-right">종목</th>
              <th className="px-2 py-2 text-right">3M 수익률</th>
              <th className="px-2 py-2 text-right">vs SPY</th>
              <th className="px-1 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isTop3 = i < 3;
              const isSelected = selected === r.key;
              const up = r.excess >= 0;
              return (
                <tr
                  key={r.key}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    isSelected ? "bg-primary/10" : isTop3 ? "bg-success/5 hover:bg-success/10" : "hover:bg-muted/20",
                  )}
                >
                  <td className={cn("px-2 py-2 tabular-nums text-sm", isTop3 ? "font-bold text-success" : "text-muted-foreground")}>
                    {i + 1}
                  </td>
                  <td className="px-2 py-2 font-semibold truncate">{r.key}</td>
                  <td className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">{r.count}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", r.wAvg >= 0 ? "text-success" : "text-destructive")}>
                    {r.wAvg >= 0 ? "+" : ""}{r.wAvg.toFixed(2)}%
                  </td>
                  <td className={cn("px-2 py-2 text-right tabular-nums font-bold", up ? "text-success" : "text-destructive")}>
                    {up ? "+" : ""}{r.excess.toFixed(2)}%
                  </td>
                  <td className="px-1 py-2 text-right">
                    <button
                      onClick={() => onPick(r.key)}
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/40 text-muted-foreground hover:bg-primary/10 hover:text-primary",
                      )}
                    >
                      {isSelected ? "선택됨" : (<>선택 <ArrowRight className="h-3 w-3" /></>)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Step 3: Industry (within selected sector)
// ═══════════════════════════════════════════════════════════════

function IndustryPanel({
  rows,
  selected,
  onPick,
}: {
  rows: AggRow[];
  selected: string | null;
  onPick: (i: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyHint msg="이 섹터의 산업 데이터가 없습니다." />;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        선택 섹터 내 산업별 3M excess vs SPY · 강한 순 정렬 · 상위 3개 자동 하이라이트
      </p>
      <div className="max-h-[400px] overflow-x-auto overflow-y-auto rounded-lg border border-border/40">
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-14" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-[72px]" />
          </colgroup>
          <thead className="sticky top-0 border-b border-border/60 bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Industry</th>
              <th className="px-2 py-2 text-right">종목</th>
              <th className="px-2 py-2 text-right">3M</th>
              <th className="px-2 py-2 text-right">vs SPY</th>
              <th className="px-1 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isTop3 = i < 3;
              const isSelected = selected === r.key;
              const up = r.excess >= 0;
              return (
                <tr
                  key={r.key}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    isSelected ? "bg-primary/10" : isTop3 ? "bg-success/5 hover:bg-success/10" : "hover:bg-muted/20",
                  )}
                >
                  <td className={cn("px-2 py-2 tabular-nums text-sm", isTop3 ? "font-bold text-success" : "text-muted-foreground")}>
                    {i + 1}
                  </td>
                  <td className="px-2 py-2 font-medium truncate">{r.key}</td>
                  <td className="px-2 py-2 text-right text-xs text-muted-foreground tabular-nums">{r.count}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums", r.wAvg >= 0 ? "text-success" : "text-destructive")}>
                    {r.wAvg >= 0 ? "+" : ""}{r.wAvg.toFixed(2)}%
                  </td>
                  <td className={cn("px-2 py-2 text-right tabular-nums font-bold", up ? "text-success" : "text-destructive")}>
                    {up ? "+" : ""}{r.excess.toFixed(2)}%
                  </td>
                  <td className="px-1 py-2 text-right">
                    <button
                      onClick={() => onPick(r.key)}
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/40 text-muted-foreground hover:bg-primary/10 hover:text-primary",
                      )}
                    >
                      {isSelected ? "선택됨" : (<>선택 <ArrowRight className="h-3 w-3" /></>)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Step 4: Stock RS + Pattern (within selected industry)
// ═══════════════════════════════════════════════════════════════

type StockEnriched = {
  row: TickerRow;
  ex1m: number | null;
  ex3m: number | null;
  ex6m: number | null;
  ex12m: number | null;
  pattern: ReturnType<typeof classifyPattern>;
};

function StockPanel({
  rows,
  selected,
  onPick,
}: {
  rows: StockEnriched[];
  selected: string | null;
  onPick: (t: string) => void;
}) {
  if (rows.length === 0) {
    return <EmptyHint msg="이 산업의 종목이 유니버스에 없습니다." />;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        선택 산업 내 종목 · 3M excess desc 정렬 · Pattern 자동 분류
      </p>
      <div className="max-h-[500px] overflow-x-auto overflow-y-auto rounded-lg border border-border/40">
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-20" />
            <col className="hidden sm:table-column" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16 hidden md:table-column" />
            <col className="w-[72px]" />
          </colgroup>
          <thead className="sticky top-0 border-b border-border/60 bg-card text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Ticker</th>
              <th className="px-2 py-2 hidden sm:table-cell">Name</th>
              <th className="px-2 py-2">Pattern</th>
              <th className="px-2 py-2 text-right">1M ex</th>
              <th className="px-2 py-2 text-right">3M ex</th>
              <th className="px-2 py-2 text-right hidden md:table-cell">6M ex</th>
              <th className="px-1 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const isSelected = selected === s.row.ticker;
              return (
                <tr
                  key={s.row.ticker}
                  className={cn(
                    "border-b border-border/30 transition-colors",
                    isSelected ? "bg-primary/10" : "hover:bg-muted/20",
                  )}
                >
                  <td className="px-2 py-2 tabular-nums text-sm text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-2 font-mono text-sm font-semibold">
                    <Link href={`/stock/${s.row.ticker}`} className="text-primary hover:underline">{s.row.ticker}</Link>
                  </td>
                  <td className="px-2 py-2 hidden sm:table-cell truncate text-xs text-muted-foreground">{s.row.name}</td>
                  <td className="px-2 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold",
                        s.pattern.tone === "success" ? "bg-success/15 text-success"
                        : s.pattern.tone === "warning" ? "bg-amber-500/15 text-amber-400"
                        : s.pattern.tone === "danger" ? "bg-destructive/15 text-destructive"
                        : "bg-muted/40 text-muted-foreground",
                      )}
                      title={s.pattern.full}
                    >
                      {s.pattern.emoji} {s.pattern.label}
                    </span>
                  </td>
                  <ExCell v={s.ex1m} />
                  <ExCell v={s.ex3m} bold />
                  <ExCell v={s.ex6m} className="hidden md:table-cell" />
                  <td className="px-1 py-2 text-right">
                    <button
                      onClick={() => onPick(s.row.ticker)}
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border/40 text-muted-foreground hover:bg-primary/10 hover:text-primary",
                      )}
                    >
                      {isSelected ? "선택됨" : (<>선택 <ArrowRight className="h-3 w-3" /></>)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExCell({ v, bold, className }: { v: number | null; bold?: boolean; className?: string }) {
  if (v === null) return <td className={cn("px-3 py-2 text-right text-sm text-muted-foreground/60", className)}>-</td>;
  const up = v >= 0;
  return (
    <td className={cn(
      "px-3 py-2 text-right tabular-nums text-sm",
      bold && "font-semibold",
      up ? "text-success" : "text-destructive",
      className,
    )}>
      {up ? "+" : ""}{v.toFixed(1)}%
    </td>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Step 5: Price Structure
// ═══════════════════════════════════════════════════════════════

function StructurePanel({ item }: { item: StockEnriched }) {
  const r = item.row;
  const ret1m = num(r.returns["1m"]);
  const ret3m = num(r.returns["3m"]);
  const ret6m = num(r.returns["6m"]);
  const ret1y = num(r.returns["1y"]);

  // Trend acceleration: 3M > 6M (annualized) means momentum picking up
  const ann3m = ret3m !== null ? ret3m * 4 : null;
  const ann6m = ret6m !== null ? ret6m * 2 : null;
  const accelerating = ann3m !== null && ann6m !== null && ann3m > ann6m;

  // 52W position (0-100%)
  const rangePos =
    r.fiftyTwoWkHigh && r.fiftyTwoWkLow && r.price
      ? ((r.price - r.fiftyTwoWkLow) / (r.fiftyTwoWkHigh - r.fiftyTwoWkLow)) * 100
      : null;

  // Volume ratio (last day vs 20d avg)
  const volRatio = r.avgVolume && r.avgVolume > 0 ? r.lastVolume / r.avgVolume : null;

  // Verdict
  const checks: Array<{ label: string; ok: boolean; note: string }> = [
    {
      label: "52주 상단 근접 (> 70%)",
      ok: rangePos !== null && rangePos >= 70,
      note: rangePos !== null ? `현재 52W 범위의 ${rangePos.toFixed(0)}%` : "데이터 없음",
    },
    {
      label: "52주 신고가 부근 (-15%)",
      ok: r.distFromHigh !== null && r.distFromHigh >= -15,
      note: r.distFromHigh !== null ? `52W 고점 대비 ${r.distFromHigh.toFixed(1)}%` : "-",
    },
    {
      label: "장기 상승 (12M > 0)",
      ok: ret1y !== null && ret1y > 0,
      note: ret1y !== null ? `12M ${ret1y >= 0 ? "+" : ""}${ret1y.toFixed(1)}%` : "-",
    },
    {
      label: "모멘텀 가속 (3M > 6M annualized)",
      ok: accelerating,
      note: ann3m !== null && ann6m !== null ? `3M 연환산 ${ann3m.toFixed(1)}% vs 6M 연환산 ${ann6m.toFixed(1)}%` : "-",
    },
    {
      label: "최근 5일 상승 우세 (> 50%)",
      ok: r.upDaysRatio > 0.5,
      note: `${(r.upDaysRatio * 100).toFixed(0)}%`,
    },
    {
      label: "당일 거래량 급증 (> 평균 1.2x)",
      ok: volRatio !== null && volRatio > 1.2,
      note: volRatio !== null ? `${volRatio.toFixed(2)}x` : "-",
    },
  ];
  const passCount = checks.filter((c) => c.ok).length;
  let verdict: "go" | "wait" | "no-go";
  let verdictText: string;
  if (passCount >= 5) {
    verdict = "go"; verdictText = "🟢 GO — 진입 후보. 손절선 (52W 저점 or 최근 스윙로우) 설정 후 진입.";
  } else if (passCount >= 3) {
    verdict = "wait"; verdictText = "🟡 WAIT — 구조 개선 대기. 신고가 돌파 + 거래량 확인 후 진입.";
  } else {
    verdict = "no-go"; verdictText = "🔴 NO-GO — 구조 취약. 상위 후보로 이동 권장.";
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-3">
        <div>
          <span className="font-mono text-lg font-bold">{r.ticker}</span>
          <span className="ml-2 text-sm text-muted-foreground">{r.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">{r.capTier}</Badge>
          <Badge variant="secondary" className="text-[10px]">{r.industry}</Badge>
          <Link
            href={`/stock/${r.ticker}`}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            상세 페이지 열기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Verdict */}
      <div
        className={cn(
          "rounded-lg border p-3 text-sm font-semibold",
          verdict === "go" ? "border-success/30 bg-success/5 text-success"
          : verdict === "wait" ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
          : "border-destructive/30 bg-destructive/5 text-destructive",
        )}
      >
        {verdictText} <span className="ml-1 font-normal">({passCount}/6 통과)</span>
      </div>

      {/* Momentum & pattern recap */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MiniStat label="1M" value={fmtPctOrDash(ret1m)} tone={sign(ret1m)} />
        <MiniStat label="3M" value={fmtPctOrDash(ret3m)} tone={sign(ret3m)} highlight />
        <MiniStat label="6M" value={fmtPctOrDash(ret6m)} tone={sign(ret6m)} />
        <MiniStat label="12M" value={fmtPctOrDash(ret1y)} tone={sign(ret1y)} />
        <MiniStat
          label="Pattern"
          value={`${item.pattern.emoji} ${item.pattern.label}`}
          tone={item.pattern.tone === "success" ? "up" : item.pattern.tone === "danger" ? "down" : "neutral"}
        />
      </div>

      {/* 52W range bar */}
      {rangePos !== null && r.fiftyTwoWkLow && r.fiftyTwoWkHigh && (
        <div className="rounded-lg border border-border/40 p-3">
          <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
            <span>${r.fiftyTwoWkLow.toFixed(2)}</span>
            <span className="font-semibold text-foreground">52W Range: {rangePos.toFixed(0)}%</span>
            <span>${r.fiftyTwoWkHigh.toFixed(2)}</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-destructive via-amber-400 to-success">
            <div
              className="absolute top-0 h-full w-1 bg-foreground shadow-lg"
              style={{ left: `${Math.min(100, Math.max(0, rangePos))}%`, transform: "translateX(-50%)" }}
            />
          </div>
        </div>
      )}

      {/* Checks */}
      <div className="rounded-lg border border-border/40">
        <div className="border-b border-border/40 px-3 py-2 text-xs font-semibold text-muted-foreground">
          구조 · 진입 체크리스트
        </div>
        <div className="divide-y divide-border/30">
          {checks.map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  c.ok ? "bg-success text-background" : "bg-destructive/30 text-destructive",
                )}
              >
                {c.ok ? "✓" : "✗"}
              </span>
              <span className={cn("flex-1", c.ok ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{c.note}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-border/40 bg-card/40 px-3 py-2", highlight && "ring-1 ring-primary/40")}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        "mt-0.5 text-sm font-bold tabular-nums truncate",
        tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : "text-foreground",
      )}>
        {value}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

function num(v: number | null | undefined): number | null {
  return typeof v === "number" ? v : null;
}
function getNum(v: number | null | undefined): number {
  return typeof v === "number" ? v : 0;
}
function excessVsSpy(r: TickerRow, s: MarketSnapshot, period: string): number | null {
  const stock = num(r.returns[period]);
  const spy = num(s.spy_returns?.[period as keyof NonNullable<typeof s.spy_returns>]);
  if (stock === null || spy === null) return null;
  return stock - spy;
}
function fmtPctOrDash(v: number | null): string {
  if (v === null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function sign(v: number | null): "up" | "down" | "neutral" {
  if (v === null) return "neutral";
  return v >= 0 ? "up" : "down";
}
