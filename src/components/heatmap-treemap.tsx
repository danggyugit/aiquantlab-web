"use client";

import { Treemap, ResponsiveContainer } from "recharts";

type Node = {
  name: string;      // ticker
  fullName: string;
  sector: string;
  size: number;      // market_cap (drives box size)
  changePct: number; // recent daily change (drives color)
};

/** Diverging red-green color scale by % change. */
function colorFor(pct: number): string {
  const t = Math.min(Math.abs(pct) / 5, 1); // ±5% saturates
  const alpha = 0.25 + t * 0.7;
  return pct >= 0
    ? `rgba(16, 185, 129, ${alpha.toFixed(2)})`
    : `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
}

// Recharts Treemap `content` prop is a React function component; the props are
// the internal node payload plus x/y/width/height. Keep types loose (any) —
// recharts' generics are painful and not worth chasing here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapNode(props: any) {
  const { x, y, width, height, name, changePct } = props;
  if (width < 2 || height < 2) return null;

  const fill = typeof changePct === "number" ? colorFor(changePct) : "rgba(100,116,139,0.25)";
  const showLabel = width > 42 && height > 26;
  const showChange = width > 60 && height > 40;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="var(--background)"
        strokeWidth={1}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showChange ? 6 : 0)}
          textAnchor="middle"
          fill="#F8FAFC"
          fontSize={Math.min(14, width / 5)}
          fontWeight={600}
        >
          {name}
        </text>
      )}
      {showChange && typeof changePct === "number" && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          fill="#F8FAFC"
          fontSize={Math.min(11, width / 7)}
        >
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%
        </text>
      )}
    </g>
  );
}

export function HeatmapTreemap({ data }: { data: Node[] }) {
  return (
    <div className="h-[560px] w-full rounded-xl border border-border/40 bg-card/40 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          stroke="var(--background)"
          content={<TreemapNode />}
          isAnimationActive={false}
        />
      </ResponsiveContainer>
    </div>
  );
}
