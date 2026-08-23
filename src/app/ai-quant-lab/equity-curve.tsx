"use client";

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BenchmarkPoint } from "@/lib/data";

type Point = { date: string; value: number; spy?: number; returnPct: number };

export function EquityCurve({
  dates,
  values,
  benchmark,
}: {
  dates: string[];
  values: number[];
  benchmark?: BenchmarkPoint[];
}) {
  if (dates.length === 0 || values.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        데이터 없음
      </div>
    );
  }

  const spyByDate = new Map((benchmark ?? []).map((b) => [b.date, b.value]));

  const data: Point[] = dates.map((d, i) => {
    const day = d.slice(0, 10);
    return {
      date: day,
      value: values[i] ?? 0,
      spy: spyByDate.get(day),
      returnPct: ((values[i] ?? 1) - 1) * 100,
    };
  });

  const hasBenchmark = (benchmark?.length ?? 0) > 0;

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.623 0.214 259.815)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="oklch(0.623 0.214 259.815)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
          <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} minTickGap={40} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickFormatter={(v) => `${v.toFixed(1)}×`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v, name) => {
              const n = Number(v);
              if (Number.isNaN(n)) return ["-", name as string];
              const label = name === "spy" ? "SPY" : "Portfolio";
              return [`${n.toFixed(3)}× (${((n - 1) * 100).toFixed(1)}%)`, label];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="oklch(0.623 0.214 259.815)"
            strokeWidth={2}
            fill="url(#equityFill)"
            name="Portfolio"
            isAnimationActive={false}
          />
          {hasBenchmark && (
            <Line
              type="monotone"
              dataKey="spy"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              name="SPY"
              isAnimationActive={false}
              connectNulls
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
      {hasBenchmark && (
        <div className="mt-1 flex items-center justify-end gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-[2px] w-4 rounded" style={{ backgroundColor: "oklch(0.623 0.214 259.815)" }} />
            Portfolio
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-[2px] w-4 border-t border-dashed border-muted-foreground" />
            SPY (동일 기간)
          </span>
        </div>
      )}
    </div>
  );
}
