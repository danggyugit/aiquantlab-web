"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; value: number; returnPct: number };

export function EquityCurve({ dates, values }: { dates: string[]; values: number[] }) {
  if (dates.length === 0 || values.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        데이터 없음
      </div>
    );
  }

  const data: Point[] = dates.map((d, i) => ({
    date: d.slice(0, 10),
    value: values[i] ?? 0,
    returnPct: ((values[i] ?? 1) - 1) * 100,
  }));

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
            formatter={(v) => {
              const n = Number(v);
              return [`${n.toFixed(3)}× (${((n - 1) * 100).toFixed(1)}%)`, "Portfolio"];
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="oklch(0.623 0.214 259.815)"
            strokeWidth={2}
            fill="url(#equityFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
