"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

type Point = { t: string; v: number };

/** Compact area chart shown under each index metric on the Dashboard.
 * Matches Streamlit's Mini Index Charts row (height 200px in Streamlit,
 * we use 120px for tighter density in a 4-col grid). */
export function IndexMiniChart({
  data,
  isUp,
}: { data: Point[]; isUp: boolean }) {
  if (data.length < 2) {
    return <div className="h-[120px]" />;
  }
  const color = isUp ? "oklch(0.777 0.152 163.223)" : "oklch(0.704 0.191 22.216)";

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`fill-${isUp ? "u" : "d"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#fill-${isUp ? "u" : "d"})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
