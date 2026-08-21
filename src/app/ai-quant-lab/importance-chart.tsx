"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ImportanceRecord } from "@/lib/data";

/**
 * Average feature importance across all rebalances → top-15 horizontal bar.
 */
export function ImportanceChart({ records }: { records: ImportanceRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        데이터 없음
      </div>
    );
  }

  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const [k, v] of Object.entries(r)) {
      if (k === "date" || typeof v !== "number") continue;
      sums.set(k, (sums.get(k) ?? 0) + v);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const avgs = Array.from(sums.entries())
    .map(([feature, sum]) => ({
      feature,
      importance: sum / (counts.get(feature) ?? 1),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15);

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={avgs}
          layout="vertical"
          margin={{ top: 8, right: 12, bottom: 0, left: 60 }}
        >
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
          <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={(v) => v.toFixed(3)} />
          <YAxis
            type="category"
            dataKey="feature"
            stroke="var(--muted-foreground)"
            fontSize={11}
            width={140}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v) => [Number(v).toFixed(5), "평균 중요도"]}
          />
          <Bar dataKey="importance" fill="oklch(0.71 0.213 303.9)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
