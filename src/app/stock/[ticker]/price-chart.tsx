"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; close: number; high: number; low: number; volume: number };

export function PriceChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        가격 데이터 없음
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.623 0.214 259.815)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="oklch(0.623 0.214 259.815)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
          <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => `$${Math.round(v)}`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, "종가"]}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="oklch(0.623 0.214 259.815)"
            strokeWidth={2}
            fill="url(#priceFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
