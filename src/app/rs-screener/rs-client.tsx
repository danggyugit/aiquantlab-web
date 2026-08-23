"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScreenerInsights } from "@/components/screener-insights";

/**
 * Relative Strength screener.
 *
 * "RS" here means EXCESS RETURN over SPY, not raw price change. A stock
 * up 3% while SPY is up 8% has negative RS (weak); a stock down 2% while
 * SPY is down 6% has positive RS (strong). This is the IBD-style RS the
 * name implies — the previous implementation was raw 5-day return and
 * gave misleading rankings in trending markets.
 *
 * Anchor period is 3M (user's chosen leadership timeframe). 1M/6M/12M
 * feed a Pattern classifier that reads the sign combination (↑/↓ of each)
 * and outputs a category so users don't have to eyeball three numbers.
 */

export type RsRow = {
  ticker: string;
  name: string;
  sector: string;
  industry: string | null;
  capTier: string;
  // Excess returns vs SPY over each period.
  ex1m: number | null;
  ex3m: number | null;
  ex6m: number | null;
  ex12m: number | null;
  /**
   * 12-1M excess: Jegadeesh-Titman academic momentum — 12M return minus the
   * most recent 1M (which has a reversal tendency). See screener/page.tsx
   * for the derivation from ex12m and ex1m.
   */
  ex12_1m: number | null;
  // Percentile rank (1-99) of the 3M excess return across the whole universe.
  rsRating: number;
  // IBD-original RS Rating: percentile of the 12M weighted price change
  // (0.4 × Q1 + 0.2 × Q2 + 0.2 × Q3 + 0.2 × Q4). Kept alongside our 3M
  // rsRating so users can toggle between "current leadership" (3M) and
  // "classic CANSLIM" (12M weighted) interpretations.
  ibdRs: number | null;
};

// ── Pattern classifier ─────────────────────────────────────────

type PatternKey =
  | "rising_leader"
  | "hot_3m"
  | "recovery"
  | "losing_leader"
  | "fading"
  | "downtrend"
  | "dead_cat"
  | "whipsaw"
  | "unknown";

type PatternInfo = {
  key: PatternKey;
  emoji: string;
  label: string;
  short: string;
  full: string;
  tone: "success" | "warning" | "danger" | "neutral";
};

const PATTERNS: Record<PatternKey, PatternInfo> = {
  rising_leader: {
    key: "rising_leader",
    emoji: "🚀",
    label: "Rising Leader",
    short: "1M ↑ · 3M ↑ · 6M ↑",
    full: "세 시점 모두 SPY 대비 강함 → 확립된 주도주. 추세 지속. 다만 1M이 과열되면 단기 조정 주의.",
    tone: "success",
  },
  hot_3m: {
    key: "hot_3m",
    emoji: "🔥",
    label: "Hot 3M",
    short: "1M ↑ · 3M ↑ · 6M ↓",
    full: "6M은 약했으나 최근 3M+1M 동시 강세 → 리버설 초기. 신규 주도주 후보. 6M이 양전환하면 확신 상승.",
    tone: "success",
  },
  recovery: {
    key: "recovery",
    emoji: "📈",
    label: "Recovery",
    short: "1M ↑ · 3M ↓ · 6M ↑",
    full: "장기 추세는 살아있고 3M 조정 후 1M 반등. 매수 후보. 3M이 양전환하는지 확인.",
    tone: "success",
  },
  losing_leader: {
    key: "losing_leader",
    emoji: "⚠️",
    label: "Losing Leader",
    short: "1M ↓ · 3M ↑ · 6M ↑",
    full: "중기 주도권은 살아있지만 최근 자금 이탈. 일시 조정일 수도 (평균회귀 매수 기회) 또는 rotation out 초기 (매도 신호). 3M이 꺾이는지 관찰.",
    tone: "warning",
  },
  fading: {
    key: "fading",
    emoji: "💧",
    label: "Fading",
    short: "1M ↓ · 3M ↓ · 6M ↑",
    full: "6M 주도주 → 3M/1M 연속 약세로 rotation out 진행 중. 매수 유보, 손절 고려.",
    tone: "warning",
  },
  downtrend: {
    key: "downtrend",
    emoji: "❌",
    label: "Downtrend",
    short: "1M ↓ · 3M ↓ · 6M ↓",
    full: "세 시점 모두 SPY 대비 약세 → 주도권 완전 상실. 반등 후보로 관찰만, 신규 매수 부적합.",
    tone: "danger",
  },
  dead_cat: {
    key: "dead_cat",
    emoji: "🐈",
    label: "Dead-cat Bounce",
    short: "1M ↑ · 3M ↓ · 6M ↓",
    full: "장기 하락 중 단기 반등 (평균회귀). 함정 가능성 높음. 3M/6M 양전환 확인 전에는 진입 위험.",
    tone: "danger",
  },
  whipsaw: {
    key: "whipsaw",
    emoji: "🌀",
    label: "Whipsaw",
    short: "1M ↑ · 3M ↓ · 6M ↑ 등 혼조",
    full: "기간별 신호가 엇갈리는 방향성 없는 상태. 관망.",
    tone: "neutral",
  },
  unknown: {
    key: "unknown",
    emoji: "—",
    label: "Data Missing",
    short: "일부 기간 데이터 없음",
    full: "1M/3M/6M 중 하나 이상 결측. 판정 유보.",
    tone: "neutral",
  },
};

export function classifyPattern(
  ex1m: number | null,
  ex3m: number | null,
  ex6m: number | null,
): PatternInfo {
  if (ex1m === null || ex3m === null || ex6m === null) return PATTERNS.unknown;
  const s1 = ex1m >= 0 ? "↑" : "↓";
  const s3 = ex3m >= 0 ? "↑" : "↓";
  const s6 = ex6m >= 0 ? "↑" : "↓";
  const combo = `${s1}${s3}${s6}`;
  switch (combo) {
    case "↑↑↑": return PATTERNS.rising_leader;
    case "↑↑↓": return PATTERNS.hot_3m;
    case "↑↓↑": return PATTERNS.recovery;
    case "↓↑↑": return PATTERNS.losing_leader;
    case "↓↓↑": return PATTERNS.fading;
    case "↓↓↓": return PATTERNS.downtrend;
    case "↑↓↓": return PATTERNS.dead_cat;
    default:    return PATTERNS.whipsaw;
  }
}

// ── Component ──────────────────────────────────────────────────

type SortKey = "ex3m" | "ex1m" | "ex6m" | "ex12m" | "ex12_1m" | "rsRating" | "ibdRs";

export function RsClient({ rows, sectors }: { rows: RsRow[]; sectors: string[] }) {
  const [sector, setSector] = useState("All");
  const [capTier, setCapTier] = useState("All");
  const [minRs, setMinRs] = useState(70);
  const [patternFilter, setPatternFilter] = useState<PatternKey | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("ex3m");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showGuide, setShowGuide] = useState(false);

  // Click column header: first click sorts desc, second click on same column flips to asc.
  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  // Attach classified pattern once per row
  const rowsWithPattern = useMemo(() => {
    return rows.map((r) => ({
      ...r,
      pattern: classifyPattern(r.ex1m, r.ex3m, r.ex6m),
    }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rowsWithPattern.filter((r) => {
      if (sector !== "All" && r.sector !== sector) return false;
      if (capTier !== "All" && r.capTier !== capTier) return false;
      if (r.rsRating < minRs) return false;
      if (patternFilter !== "All" && r.pattern.key !== patternFilter) return false;
      return true;
    });
  }, [rowsWithPattern, sector, capTier, minRs, patternFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "desc" ? 1 : -1;
    const cmp = (a: (typeof filtered)[number], b: (typeof filtered)[number]) => {
      const av = sortKey === "rsRating"
        ? a.rsRating
        : sortKey === "ibdRs"
          ? (a.ibdRs ?? -Infinity)
          : (a[sortKey] ?? -Infinity);
      const bv = sortKey === "rsRating"
        ? b.rsRating
        : sortKey === "ibdRs"
          ? (b.ibdRs ?? -Infinity)
          : (b[sortKey] ?? -Infinity);
      return (bv - av) * dir;
    };
    return [...filtered].sort(cmp);
  }, [filtered, sortKey, sortDir]);

  // Histogram of RS Rating (3M excess percentile)
  const histogram = useMemo(() => {
    const buckets = Array.from({ length: 20 }, (_, i) => ({
      bucket: `${i * 5}-${i * 5 + 4}`,
      binStart: i * 5,
      count: 0,
    }));
    for (const r of rowsWithPattern) {
      if (sector !== "All" && r.sector !== sector) continue;
      if (capTier !== "All" && r.capTier !== capTier) continue;
      const idx = Math.min(19, Math.floor(r.rsRating / 5));
      buckets[idx].count += 1;
    }
    return buckets;
  }, [rowsWithPattern, sector, capTier]);

  // Pattern distribution across the current filter (excluding rsRating cutoff to be useful)
  const patternCounts = useMemo(() => {
    const counts = new Map<PatternKey, number>();
    for (const r of rowsWithPattern) {
      if (sector !== "All" && r.sector !== sector) continue;
      if (capTier !== "All" && r.capTier !== capTier) continue;
      counts.set(r.pattern.key, (counts.get(r.pattern.key) ?? 0) + 1);
    }
    return counts;
  }, [rowsWithPattern, sector, capTier]);

  const top90 = filtered.filter((r) => r.rsRating >= 90);
  const avgRs = filtered.length
    ? Math.round(filtered.reduce((a, b) => a + b.rsRating, 0) / filtered.length)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Pattern guide — expandable */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">📚 Pattern 가이드</CardTitle>
              <CardDescription className="text-xs">
                1M/3M/6M 세 시점 excess return (SPY 대비) 부호 조합으로 자동 판정
              </CardDescription>
            </div>
            <button
              onClick={() => setShowGuide((v) => !v)}
              className="rounded-md border border-border/40 bg-muted/30 px-2.5 py-1 text-xs hover:bg-muted/50"
            >
              {showGuide ? "접기" : "펼치기"}
            </button>
          </div>
        </CardHeader>
        {showGuide && (
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-2 md:grid-cols-2">
              {[
                PATTERNS.rising_leader,
                PATTERNS.hot_3m,
                PATTERNS.recovery,
                PATTERNS.losing_leader,
                PATTERNS.fading,
                PATTERNS.downtrend,
                PATTERNS.dead_cat,
                PATTERNS.whipsaw,
              ].map((p) => (
                <div
                  key={p.key}
                  className={cn(
                    "rounded-lg border p-2.5",
                    p.tone === "success" ? "border-success/30 bg-success/5"
                    : p.tone === "danger" ? "border-destructive/30 bg-destructive/5"
                    : p.tone === "warning" ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border/40 bg-muted/20",
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-base">{p.emoji}</span>
                    <span className="font-semibold text-sm">{p.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">{p.short}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{p.full}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px]">
              <div className="font-semibold text-primary">💡 해석 요령</div>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                <li>• <strong className="text-foreground">6M</strong> = 큰 방향 (Stage) · <strong className="text-foreground">3M</strong> = 현재 주도권 (앵커) · <strong className="text-foreground">1M</strong> = 최근 변화</li>
                <li>• <strong className="text-foreground">1M ↓ + 3M ↑ + 6M ↑</strong> (Losing Leader): 조정 vs 이탈 판별이 어려움 — <strong>3M이 꺾이면 매도</strong>, 살아있으면 매수 후보</li>
                <li>• <strong className="text-foreground">1M ↑ + 3M ↓ + 6M ↓</strong> (Dead-cat): 함정 확률 높음, 3M/6M 양전환 전 신규 진입 지양</li>
                <li>• <strong className="text-foreground">RS(3M)</strong> = 3M excess return 백분위 (1-99). 90+ = 상위 10%. <strong>사용자 앵커 (현재 주도권)</strong>.</li>
                <li>• <strong className="text-foreground">IBD RS</strong> = William O'Neil 원본 방식. 12M 가중 raw 수익률 (0.4×최근3M + 0.3×중간3M + 0.3×이전6M) 의 백분위. <strong>정통 CANSLIM 기준</strong>이며 장기 관점. O'Neil 룰: RS 80 미만 매수 금지, 90+ 최적.</li>
                <li>• <strong className="text-foreground">RS(3M) vs IBD RS 차이</strong>: 예) RS(3M) 95 · IBD RS 70 → 최근 3개월만 급등한 신흥 종목. 반대로 RS(3M) 60 · IBD RS 92 → 장기 주도주가 최근 조정 중. 두 값의 gap이 종목의 <strong>스토리</strong>를 알려줌.</li>
                <li>• <strong className="text-foreground">12-1M ex</strong>는 학술 표준 Jegadeesh-Titman 모멘텀 (12개월 수익률에서 최근 1개월 제외) · SPY 대비. 최근 1개월의 <strong>단기 평균회귀(reversal)</strong> 효과를 배제한 순수 중기 추세. 12M ex와 12-1M ex의 차이가 크면 최근 1개월이 그만큼 이례적이라는 뜻.</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">섹터</Label>
              <Select value={sector} onValueChange={(v) => setSector((v as string) ?? "All")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">전체</SelectItem>
                  {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">시총 구간</Label>
              <Select value={capTier} onValueChange={(v) => setCapTier((v as string) ?? "All")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">전체</SelectItem>
                  <SelectItem value="Large Cap">Large Cap</SelectItem>
                  <SelectItem value="Mid Cap">Mid Cap</SelectItem>
                  <SelectItem value="Small Cap">Small Cap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">
                최소 RS Rating <span className="ml-1 text-primary font-mono">≥ {minRs}</span>
              </Label>
              <input
                type="range" min={1} max={99} step={1}
                value={minRs}
                onChange={(e) => setMinRs(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
          {/* Pattern filter chips */}
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Pattern 필터</Label>
            <div className="flex flex-wrap gap-1.5">
              <PatternChip
                active={patternFilter === "All"}
                onClick={() => setPatternFilter("All")}
                label="All"
                count={rowsWithPattern.length}
              />
              {(Object.keys(PATTERNS) as PatternKey[])
                .filter((k) => k !== "unknown")
                .map((k) => {
                  const p = PATTERNS[k];
                  const n = patternCounts.get(k) ?? 0;
                  return (
                    <PatternChip
                      key={k}
                      active={patternFilter === k}
                      onClick={() => setPatternFilter(k)}
                      label={`${p.emoji} ${p.label}`}
                      count={n}
                      tone={p.tone}
                    />
                  );
                })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <MetricTile label="Scanned" value={rows.length.toLocaleString()} />
        <MetricTile label="Filtered" value={filtered.length.toLocaleString()} />
        <MetricTile label="RS 90+" value={top90.length.toLocaleString()} tone="success" />
        <MetricTile label="Avg RS" value={String(avgRs)} tone={avgRs >= 70 ? "success" : "neutral"} />
        <MetricTile label="Sort" value={sortKey === "rsRating" ? "RS" : sortKey.toUpperCase()} />
      </div>

      {/* Where are the results clustered? sector · industry breakdown */}
      <ScreenerInsights filtered={filtered} universe={rows} />

      {/* Histogram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">RS Rating 분포</CardTitle>
          <CardDescription className="text-[10px]">3M excess return 백분위 히스토그램 (전체 유니버스)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[160px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="bucket" fontSize={9} stroke="var(--muted-foreground)" interval={1} />
                <YAxis fontSize={9} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11 }}
                />
                <ReferenceLine x="90-94" stroke="oklch(0.777 0.152 163.223)" strokeDasharray="2 2" />
                <ReferenceLine x="70-74" stroke="var(--muted-foreground)" strokeDasharray="2 2" />
                <Bar dataKey="count">
                  {histogram.map((h, i) => (
                    <Cell key={i} fill={h.binStart >= 80 ? "oklch(0.777 0.152 163.223)" : h.binStart >= 50 ? "oklch(0.623 0.214 259.815)" : "oklch(0.704 0.191 22.216)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Result table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="text-sm">Results ({sorted.length.toLocaleString()})</CardTitle>
            <div className="text-[11px] text-muted-foreground">
              💡 컬럼 헤더 클릭 → 정렬 · 다시 클릭 → 방향 반전 · 현재:{" "}
              <span className="font-mono font-semibold text-primary">
                {sortKey === "rsRating" ? "RS(3M)"
                  : sortKey === "ibdRs" ? "IBD RS"
                  : sortKey === "ex12_1m" ? "12-1M"
                  : sortKey.slice(2).toUpperCase()}
                {" "}{sortDir === "desc" ? "↓" : "↑"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[820px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b border-border/60 bg-card text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 w-12">#</th>
                  <th className="px-3 py-2.5">Ticker</th>
                  <th className="px-3 py-2.5 hidden md:table-cell">Name</th>
                  <th className="px-3 py-2.5 hidden sm:table-cell">Sector</th>
                  <th className="px-3 py-2.5">Pattern</th>
                  <SortHeader label="1M ex" k="ex1m" active={sortKey === "ex1m"} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="3M ex" k="ex3m" active={sortKey === "ex3m"} dir={sortDir} onClick={toggleSort} />
                  <SortHeader label="6M ex" k="ex6m" active={sortKey === "ex6m"} dir={sortDir} onClick={toggleSort} className="hidden sm:table-cell" />
                  <SortHeader label="12M ex" k="ex12m" active={sortKey === "ex12m"} dir={sortDir} onClick={toggleSort} className="hidden md:table-cell" />
                  <SortHeader
                    label="12-1M ex"
                    k="ex12_1m"
                    active={sortKey === "ex12_1m"}
                    dir={sortDir}
                    onClick={toggleSort}
                    className="hidden lg:table-cell"
                    title="12개월 수익률에서 최근 1개월 제외 (Jegadeesh-Titman 학술 모멘텀 · SPY 대비)"
                  />
                  <SortHeader
                    label="RS(3M)"
                    k="rsRating"
                    active={sortKey === "rsRating"}
                    dir={sortDir}
                    onClick={toggleSort}
                    className="w-16"
                    title="3M excess return 백분위 (사용자 앵커)"
                  />
                  <SortHeader
                    label="IBD RS"
                    k="ibdRs"
                    active={sortKey === "ibdRs"}
                    dir={sortDir}
                    onClick={toggleSort}
                    className="w-16"
                    title="12M 가중 raw 수익률 백분위 (O'Neil 원본 · 0.4×최근3M + 0.3×3-6M + 0.3×6-12M)"
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.slice(0, 300).map((r, i) => (
                  <tr key={r.ticker} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums text-sm">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-sm font-semibold">
                      <Link href={`/stock/${r.ticker}`} className="text-primary hover:underline">{r.ticker}</Link>
                    </td>
                    <td className="px-3 py-2 truncate max-w-[220px] hidden md:table-cell text-sm text-muted-foreground">{r.name}</td>
                    <td className="px-3 py-2 hidden sm:table-cell text-xs text-muted-foreground">{r.sector}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold",
                          r.pattern.tone === "success" ? "bg-success/15 text-success"
                          : r.pattern.tone === "warning" ? "bg-amber-500/15 text-amber-400"
                          : r.pattern.tone === "danger" ? "bg-destructive/15 text-destructive"
                          : "bg-muted/40 text-muted-foreground",
                        )}
                        title={r.pattern.full}
                      >
                        {r.pattern.emoji} {r.pattern.label}
                      </span>
                    </td>
                    <ExCell v={r.ex1m} />
                    <ExCell v={r.ex3m} bold />
                    <ExCell v={r.ex6m} className="hidden sm:table-cell" />
                    <ExCell v={r.ex12m} className="hidden md:table-cell" />
                    <ExCell v={r.ex12_1m} className="hidden lg:table-cell" />
                    <td className={cn(
                      "px-3 py-2 text-right tabular-nums font-bold text-base w-16",
                      r.rsRating >= 90 ? "text-success" : r.rsRating >= 70 ? "text-foreground" : "text-muted-foreground",
                    )}>
                      {r.rsRating}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right tabular-nums font-bold text-base w-16",
                      r.ibdRs === null ? "text-muted-foreground/60"
                        : r.ibdRs >= 90 ? "text-success"
                        : r.ibdRs >= 70 ? "text-foreground"
                        : "text-muted-foreground",
                    )}>
                      {r.ibdRs ?? "-"}
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      필터 조건에 맞는 종목이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {sorted.length > 300 && (
            <div className="border-t border-border/40 px-3 py-2 text-center text-xs text-muted-foreground">
              상위 300개 표시 · 필터를 좁혀서 확인하세요.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function SortHeader({
  label,
  k,
  active,
  dir,
  onClick,
  className,
  title,
}: {
  label: string;
  k: SortKey;
  active: boolean;
  dir: "desc" | "asc";
  onClick: (k: SortKey) => void;
  className?: string;
  title?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-right cursor-pointer select-none transition-colors",
        active ? "bg-primary/10 text-primary" : "hover:bg-muted/40",
        className,
      )}
      onClick={() => onClick(k)}
      title={title ?? `${label} 정렬 ${active ? (dir === "desc" ? "(↓)" : "(↑)") : ""}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active ? (
          dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
        ) : (
          <span className="inline-block w-3 opacity-30">↕</span>
        )}
      </span>
    </th>
  );
}

function ExCell({
  v,
  bold,
  className,
}: { v: number | null; bold?: boolean; className?: string }) {
  if (v === null) {
    return <td className={cn("px-3 py-2 text-right text-sm text-muted-foreground/60", className)}>-</td>;
  }
  const up = v >= 0;
  return (
    <td
      className={cn(
        "px-3 py-2 text-right tabular-nums text-sm",
        bold && "font-semibold",
        up ? "text-success" : "text-destructive",
        className,
      )}
    >
      {up ? "+" : ""}{v.toFixed(1)}%
    </td>
  );
}

function PatternChip({
  active,
  onClick,
  label,
  count,
  tone = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "success" | "warning" | "danger" | "neutral";
}) {
  const activeColors =
    tone === "success" ? "border-success/60 bg-success/15 text-success"
    : tone === "warning" ? "border-amber-500/60 bg-amber-500/15 text-amber-400"
    : tone === "danger" ? "border-destructive/60 bg-destructive/15 text-destructive"
    : "border-primary/60 bg-primary/15 text-primary";
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active ? activeColors + " font-semibold" : "border-border/40 text-muted-foreground hover:bg-muted/40",
      )}
    >
      {label} <span className="opacity-60">·{count}</span>
    </button>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "neutral";
}) {
  const color = tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xl font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}
