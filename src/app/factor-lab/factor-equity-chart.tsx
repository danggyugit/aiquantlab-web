"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type EquityPoint = { date: string; portfolio: number; spy?: number };

export function FactorEquityChart({ data }: { data: EquityPoint[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
          <XAxis
            dataKey="date"
            stroke="var(--muted-foreground)"
            fontSize={10}
            interval={Math.max(0, Math.floor(data.length / 8))}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={10}
            domain={["dataMin - 0.05", "dataMax + 0.05"]}
            tickFormatter={(v: number) => v.toFixed(2)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v ?? "-"))}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="portfolio" name="포트폴리오" stroke="oklch(0.72 0.19 155)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="spy" name="SPY" stroke="oklch(0.65 0.13 260)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
