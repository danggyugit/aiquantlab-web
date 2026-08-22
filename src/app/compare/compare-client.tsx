"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ComparePrice = { date: string; close: number };

export type CompareFundamentals = {
  pe: number | null;
  pb: number | null;
  eps: number | null;
  roe: number | null;
  divYield: number | null;
  beta: number | null;
  hi52: number | null;
  lo52: number | null;
};

export type CompareTickerData = {
  ticker: string;
  name: string;
  sector: string;
  marketCap: string;
  currentPrice: number | null;
  changePct: number | null;
  prices: ComparePrice[];
  fundamentals: CompareFundamentals | null;
};

// Series colors mirror --chart-1..5 in globals.css. Kept in this order to
// match Streamlit's Plotly default palette rotation.
const COLORS = [
  "oklch(0.623 0.214 259.815)",   // blue
  "oklch(0.777 0.152 163.223)",   // emerald
  "oklch(0.71 0.213 303.9)",      // purple
  "oklch(0.828 0.189 84.429)",    // amber
  "oklch(0.704 0.191 22.216)",    // red
];

export function CompareClient({ allTickers }: { allTickers: CompareTickerData[] }) {
  const [selected, setSelected] = useState<string[]>(["AAPL", "MSFT", "GOOGL", "NVDA"]);
  const [query, setQuery] = useState("");

  const tickerMap = useMemo(
    () => new Map(allTickers.map((t) => [t.ticker, t])),
    [allTickers],
  );

  const activeData = useMemo(
    () => selected.map((s) => tickerMap.get(s)).filter((x): x is CompareTickerData => !!x),
    [selected, tickerMap],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    return allTickers
      .filter((t) => !selected.includes(t.ticker))
      .filter((t) => t.ticker.startsWith(q) || t.name.toUpperCase().includes(q))
      .slice(0, 8);
  }, [query, allTickers, selected]);

  function addTicker(t: string) {
    if (selected.length >= 5) return;
    if (selected.includes(t)) return;
    setSelected([...selected, t]);
    setQuery("");
  }

  function removeTicker(t: string) {
    setSelected(selected.filter((x) => x !== t));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ═══ 1. Input Controls ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            종목 선택 <span className="text-xs font-normal text-muted-foreground">최대 5개</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {selected.map((t, i) => {
              const info = tickerMap.get(t);
              return (
                <button
                  key={t}
                  onClick={() => removeTicker(t)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold hover:bg-muted/40"
                  style={{ borderColor: COLORS[i], color: COLORS[i] }}
                >
                  <span className="font-mono">{t}</span>
                  {info && (
                    <span className="max-w-[100px] truncate text-muted-foreground">
                      {info.name}
                    </span>
                  )}
                  <X className="h-3 w-3" />
                </button>
              );
            })}
            {selected.length === 0 && (
              <span className="text-xs text-muted-foreground">아래에서 종목을 추가하세요</span>
            )}
          </div>
          <div className="relative">
            <Input
              placeholder="티커 또는 이름 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={selected.length >= 5}
            />
            {suggestions.length > 0 && (
              <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {suggestions.map((s) => (
                  <button
                    key={s.ticker}
                    onClick={() => addTicker(s.ticker)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40"
                  >
                    <span>
                      <span className="mr-2 font-mono font-semibold text-primary">
                        {s.ticker}
                      </span>
                      <span className="text-muted-foreground">{s.name}</span>
                    </span>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ═══ 2. Overview Cards (per-ticker: price + change) ═══ */}
      {activeData.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {activeData.map((t, i) => (
            <OverviewCard key={t.ticker} data={t} color={COLORS[i]} />
          ))}
        </div>
      )}

      {/* ═══ 3. Normalized Performance (multi-line, start=100) ═══ */}
      <NormalizedPerformanceCard data={activeData} />

      {/* ═══ 4. Returns Comparison ═══ */}
      {activeData.length > 0 && <ReturnBarCard data={activeData} />}

      {/* ═══ 5. Fundamentals Comparison Table ═══ */}
      {activeData.length > 0 && <FundamentalsTable data={activeData} />}

      {/* ═══ 6. Visual Profile (Radar Chart) ═══ */}
      {activeData.length > 0 && <RadarProfileCard data={activeData} />}

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">데이터 한계:</strong> 가격 캐시는 최근 5거래일 →
        정규화 성과 차트는 단기만 표시. 장기 비교는 12M 히스토리 캐시 확장 후 지원.
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function OverviewCard({ data, color }: { data: CompareTickerData; color: string }) {
  const isUp = (data.changePct ?? 0) >= 0;
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: `${color}55`, background: `${color}0d` }}
    >
      <div className="font-mono text-sm font-bold" style={{ color }}>
        {data.ticker}
      </div>
      <div className="truncate text-[10px] text-muted-foreground">{data.name}</div>
      <div className="mt-1 text-lg font-bold tabular-nums">
        {data.currentPrice !== null ? `$${data.currentPrice.toFixed(2)}` : "-"}
      </div>
      <div
        className={cn(
          "text-xs font-semibold tabular-nums",
          isUp ? "text-success" : "text-destructive",
        )}
      >
        {data.changePct !== null
          ? `${isUp ? "+" : ""}${data.changePct.toFixed(2)}%`
          : "-"}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{data.marketCap}</div>
    </div>
  );
}

function NormalizedPerformanceCard({ data }: { data: CompareTickerData[] }) {
  const chartData = useMemo(() => {
    if (data.length === 0) return [];
    const dates = data[0].prices.map((p) => p.date);
    return dates.map((date, i) => {
      const row: Record<string, string | number> = { date };
      for (const t of data) {
        const first = t.prices[0]?.close;
        const point = t.prices[i]?.close;
        if (first && point) {
          row[t.ticker] = ((point / first) * 100).toFixed(2);
        }
      }
      return row;
    });
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Normalized Performance</CardTitle>
        <CardDescription className="text-xs">첫 거래일 = 100 기준 상대 성과</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {data.map((t, i) => (
                  <Line
                    key={t.ticker}
                    type="monotone"
                    dataKey={t.ticker}
                    stroke={COLORS[i]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            종목을 선택하세요
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReturnBarCard({ data }: { data: CompareTickerData[] }) {
  const rows = data
    .map((t) => {
      const first = t.prices[0]?.close;
      const last = t.prices[t.prices.length - 1]?.close;
      const ret = first && last ? (last / first - 1) * 100 : 0;
      return { ticker: t.ticker, ret };
    })
    .sort((a, b) => b.ret - a.ret);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Return Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: 60 + rows.length * 40 }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 40 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v) => `${v.toFixed(1)}%`} />
              <YAxis type="category" dataKey="ticker" stroke="var(--muted-foreground)" fontSize={11} width={50} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => [`${Number(v).toFixed(2)}%`, "Return"]}
              />
              <Bar dataKey="ret" fill="oklch(0.777 0.152 163.223)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function FundamentalsTable({ data }: { data: CompareTickerData[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">Fundamentals Comparison</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2 text-right">PER</th>
              <th className="px-3 py-2 text-right">PBR</th>
              <th className="px-3 py-2 text-right">EPS</th>
              <th className="px-3 py-2 text-right">ROE</th>
              <th className="px-3 py-2 text-right">배당%</th>
              <th className="px-3 py-2 text-right">Beta</th>
              <th className="px-3 py-2 text-right">52W High</th>
              <th className="px-3 py-2 text-right">52W Low</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t, i) => {
              const f = t.fundamentals;
              return (
                <tr key={t.ticker} className="border-b border-border/30">
                  <td className="px-3 py-2 font-mono text-xs font-bold" style={{ color: COLORS[i] }}>
                    <Link href={`/stock/${t.ticker}`} className="hover:underline">{t.ticker}</Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{f?.pe && f.pe > 0 ? f.pe.toFixed(1) : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f?.pb ? f.pb.toFixed(2) : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f?.eps ? `$${f.eps.toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f?.roe ? `${(f.roe * 100).toFixed(1)}%` : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {f?.divYield && f.divYield > 0 ? `${f.divYield.toFixed(2)}%` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{f?.beta ? f.beta.toFixed(2) : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f?.hi52 ? `$${f.hi52.toFixed(0)}` : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f?.lo52 ? `$${f.lo52.toFixed(0)}` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RadarProfileCard({ data }: { data: CompareTickerData[] }) {
  // Normalize each fundamentals metric to 0-1 across the selected tickers.
  const metrics = useMemo(() => {
    const rows = data.map((t) => ({
      ticker: t.ticker,
      PER: (t.fundamentals?.pe && t.fundamentals.pe > 0 ? t.fundamentals.pe : null),
      PBR: t.fundamentals?.pb ?? null,
      ROE: t.fundamentals?.roe ?? null,
      DivYield: t.fundamentals?.divYield ?? null,
      Beta: t.fundamentals?.beta ?? null,
    }));

    // For each metric, min-max normalize across the row values.
    const metricKeys = ["PER", "PBR", "ROE", "DivYield", "Beta"] as const;
    const norm: Record<string, number>[] = rows.map((r) => ({ ticker: 0 } as unknown as Record<string, number>));
    for (const m of metricKeys) {
      const vals = rows.map((r) => r[m]).filter((v): v is number => v !== null);
      if (vals.length === 0) continue;
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = max - min;
      rows.forEach((r, i) => {
        const v = r[m];
        norm[i][m] = v !== null && range > 0 ? (v - min) / range : 0.5;
      });
    }

    // Rebuild as recharts radar data: one entry per metric, keys per ticker.
    return metricKeys.map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const point: any = { metric: m };
      rows.forEach((r, i) => {
        point[r.ticker] = norm[i][m] ?? 0;
      });
      return point;
    });
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visual Profile</CardTitle>
        <CardDescription className="text-xs">
          펀더멘털 5지표 · 선택 종목 간 정규화 (0~1)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={metrics} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 1]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
              {data.map((t, i) => (
                <Radar
                  key={t.ticker}
                  name={t.ticker}
                  dataKey={t.ticker}
                  stroke={COLORS[i]}
                  fill={COLORS[i]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
