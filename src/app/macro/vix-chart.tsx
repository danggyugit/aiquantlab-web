"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; close: number };

export function VixChart({ data }: { data: Point[] }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="vixLine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.623 0.214 259.815)" stopOpacity={1} />
              <stop offset="100%" stopColor="oklch(0.623 0.214 259.815)" stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
          <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} interval={12} />
          <YAxis stroke="var(--muted-foreground)" fontSize={10} domain={[10, "dataMax + 2"]} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="url(#vixLine)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
