"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { Plus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ComparePrice = { date: string; close: number };
export type CompareTickerData = {
  ticker: string;
  name: string;
  sector: string;
  prices: ComparePrice[];
};

// Series colors mapped to `--chart-1..5` in globals.css.
const COLORS = [
  "oklch(0.623 0.214 259.815)",   // blue
  "oklch(0.777 0.152 163.223)",   // emerald
  "oklch(0.71 0.213 303.9)",      // purple
  "oklch(0.828 0.189 84.429)",    // amber
  "oklch(0.704 0.191 22.216)",    // red
];

export function CompareClient({ allTickers }: { allTickers: CompareTickerData[] }) {
  const [selected, setSelected] = useState<string[]>(["AAPL", "MSFT", "GOOGL"]);
  const [query, setQuery] = useState("");

  const tickerMap = useMemo(() => new Map(allTickers.map((t) => [t.ticker, t])), [allTickers]);

  const activeData = useMemo(
    () => selected.map((s) => tickerMap.get(s)).filter((x): x is CompareTickerData => !!x),
    [selected, tickerMap],
  );

  // Normalize each series: first close = 100
  const chartData = useMemo(() => {
    if (activeData.length === 0) return [];
    // Use dates from first ticker as x axis
    const dates = activeData[0].prices.map((p) => p.date);
    return dates.map((date, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: Record<string, any> = { date };
      for (const t of activeData) {
        const first = t.prices[0]?.close;
        const point = t.prices[i]?.close;
        if (first && point) {
          row[t.ticker] = ((point / first) * 100).toFixed(2);
        }
      }
      return row;
    });
  }, [activeData]);

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
      {/* Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">종목 선택 <span className="text-xs font-normal text-muted-foreground">최대 5개</span></CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Selected chips */}
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
                  {info && <span className="max-w-[100px] truncate text-muted-foreground">{info.name}</span>}
                  <X className="h-3 w-3" />
                </button>
              );
            })}
            {selected.length === 0 && (
              <span className="text-xs text-muted-foreground">아래에서 종목을 추가하세요</span>
            )}
          </div>

          {/* Add form */}
          <div className="relative">
            <Input
              placeholder="티커 또는 이름으로 검색 (AAPL, Apple...)"
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
                      <span className="mr-2 font-mono font-semibold text-primary">{s.ticker}</span>
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

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">정규화 수익률</CardTitle>
          <CardDescription className="text-xs">
            각 종목의 첫 거래일을 100으로 스케일링한 상대 성과
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickMargin={6} />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => v.toFixed(0)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {activeData.map((t, i) => (
                    <Line
                      key={t.ticker}
                      type="monotone"
                      dataKey={t.ticker}
                      stroke={COLORS[i]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              종목을 하나 이상 선택하면 차트가 표시됩니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Return table */}
      {activeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">기간 성과</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Ticker</th>
                  <th className="px-3 py-2">회사</th>
                  <th className="px-3 py-2">섹터</th>
                  <th className="px-3 py-2 text-right">시작가</th>
                  <th className="px-3 py-2 text-right">현재가</th>
                  <th className="px-3 py-2 text-right">기간 수익률</th>
                </tr>
              </thead>
              <tbody>
                {activeData.map((t, i) => {
                  const first = t.prices[0]?.close;
                  const last = t.prices[t.prices.length - 1]?.close;
                  const ret = first && last ? ((last / first - 1) * 100) : 0;
                  return (
                    <tr key={t.ticker} className="border-b border-border/30">
                      <td className="px-3 py-2 font-mono text-xs font-semibold" style={{ color: COLORS[i] }}>
                        {t.ticker}
                      </td>
                      <td className="max-w-[200px] truncate px-3 py-2">{t.name}</td>
                      <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{t.sector}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${first?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${last?.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-semibold ${ret >= 0 ? "text-success" : "text-destructive"}`}>
                        {ret >= 0 ? "+" : ""}
                        {ret.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">데이터 한계:</strong> 현재 캐시는 최근 5거래일만 저장 → 단기 비교만 가능.
        1개월/1년 비교를 위해서는 stock-dashboard에 별도의 히스토리 캐시 스크립트가 필요합니다.
      </div>
    </div>
  );
}
