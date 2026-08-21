"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { IcRecord } from "@/lib/data";

export function IcChart({ records }: { records: IcRecord[] }) {
  const data = records.map((r) => ({
    date: r.date.slice(0, 7),
    IC: r.IC ?? r.IC_RF ?? 0,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
          <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={10} minTickGap={30} />
          <YAxis stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => v.toFixed(2)} />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [Number(v).toFixed(4), "IC"]}
          />
          <Bar dataKey="IC">
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.IC >= 0 ? "oklch(0.777 0.152 163.223)" : "oklch(0.704 0.191 22.216)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
