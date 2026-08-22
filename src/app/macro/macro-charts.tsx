"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MacroPoint } from "@/lib/data";

const AXIS_STYLE = { fill: "var(--muted-foreground)", fontSize: 10 } as const;

/** Format string keys for chart y-axis ticks. Server components can't
 * pass functions to client components, so we pick a formatter by name. */
export type ChartFormat =
  | "raw"
  | "pct2"       // "3.14%"
  | "pct1"       // "3.1%"
  | "pct0"       // "3%"
  | "usd_b"      // "$123B" (input in $B)
  | "usd_t_mil"  // "$4.5T" (input in $M)
  | "usd_t_bil"  // "$4.5T" (input in $B)
  | "usd_int";   // "$85"

function formatterFor(fmt: ChartFormat | undefined): ((v: number) => string) | undefined {
  switch (fmt) {
    case "pct2": return (v) => `${v.toFixed(2)}%`;
    case "pct1": return (v) => `${v.toFixed(1)}%`;
    case "pct0": return (v) => `${v.toFixed(0)}%`;
    case "usd_b": return (v) => `$${v.toFixed(0)}B`;
    case "usd_t_mil": return (v) => `$${(v / 1e6).toFixed(2)}T`;
    case "usd_t_bil": return (v) => `$${(v / 1e3).toFixed(2)}T`;
    case "usd_int": return (v) => `$${v.toFixed(0)}`;
    default: return undefined;
  }
}
const GRID_PROPS = { strokeDasharray: "2 4", stroke: "var(--border)", opacity: 0.4 } as const;
const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
} as const;

/** Simple filled-area line (used by RRP/TGA/Reserves/HY/DXY/Gold/WTI panels). */
export function MacroAreaChart({
  data,
  height = 220,
  color = "oklch(0.623 0.214 259.815)",
  format,
  refValueY,
}: {
  data: MacroPoint[];
  height?: number;
  color?: string;
  format?: ChartFormat;
  refValueY?: number;
}) {
  if (!data.length) return <ChartEmpty height={height} />;
  const id = `fill-${color.replace(/[^a-z0-9]/gi, "")}`;
  const fmt = formatterFor(format);
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={40} />
          <YAxis tick={AXIS_STYLE} tickFormatter={fmt} domain={["auto", "auto"]} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {refValueY !== undefined && (
            <ReferenceLine y={refValueY} stroke="oklch(0.704 0.191 22.216)" strokeDasharray="4 4" />
          )}
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.8} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Net Liquidity vs S&P 500 — dual line (Streamlit's "Net Liquidity vs S&P500"). */
export function NetLiquidityChart({
  netLiq,
  spy,
  height = 320,
}: {
  netLiq: MacroPoint[];
  spy: MacroPoint[];
  height?: number;
}) {
  if (!netLiq.length) return <ChartEmpty height={height} />;
  // Align by date — merge both series
  const spyMap = new Map(spy.map((p) => [p.date, p.value]));
  const merged = netLiq.map((p) => ({
    date: p.date,
    net: p.value / 1e6, // millions → trillions
    spy: spyMap.get(p.date),
  }));
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer>
        <LineChart data={merged} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={50} />
          <YAxis
            yAxisId="left"
            tick={AXIS_STYLE}
            tickFormatter={(v: number) => `$${v.toFixed(2)}T`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_STYLE}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="net"
            stroke="oklch(0.623 0.214 259.815)"
            strokeWidth={2}
            dot={false}
            name="Net Liquidity ($T)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="spy"
            stroke="oklch(0.769 0.188 70.08)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            name="S&P 500"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Treasury 10Y / 2Y with spread. Dual y-axis. */
export function TreasuryChart({
  dgs10,
  dgs2,
  height = 300,
}: {
  dgs10: MacroPoint[];
  dgs2: MacroPoint[];
  height?: number;
}) {
  if (!dgs10.length) return <ChartEmpty height={height} />;
  const dgs2Map = new Map(dgs2.map((p) => [p.date, p.value]));
  const merged = dgs10.map((p) => {
    const twoY = dgs2Map.get(p.date);
    return {
      date: p.date,
      ten: p.value,
      two: twoY,
      spread: twoY !== undefined ? p.value - twoY : undefined,
    };
  });
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer>
        <LineChart data={merged} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={50} />
          <YAxis
            yAxisId="left"
            tick={AXIS_STYLE}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_STYLE}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          />
          <ReferenceLine yAxisId="right" y={0} stroke="var(--border)" strokeDasharray="4 4" />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="ten"
            stroke="oklch(0.623 0.214 259.815)"
            strokeWidth={1.8}
            dot={false}
            name="10Y"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="two"
            stroke="oklch(0.777 0.152 163.223)"
            strokeWidth={1.5}
            dot={false}
            name="2Y"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="spread"
            stroke="oklch(0.769 0.188 70.08)"
            strokeWidth={1}
            strokeDasharray="3 3"
            dot={false}
            name="10Y-2Y"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** M1/M2 line chart. */
export function MoneySupplyChart({
  m1,
  m2,
  height = 280,
}: { m1: MacroPoint[]; m2: MacroPoint[]; height?: number }) {
  if (!m2.length) return <ChartEmpty height={height} />;
  const m1Map = new Map(m1.map((p) => [p.date, p.value]));
  const merged = m2.map((p) => ({
    date: p.date,
    m2: p.value / 1e3, // billions
    m1: (m1Map.get(p.date) ?? 0) / 1e3,
  }));
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer>
        <LineChart data={merged} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={50} />
          <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => `$${v.toFixed(1)}T`} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="m2" stroke="oklch(0.623 0.214 259.815)" strokeWidth={1.8} dot={false} name="M2" />
          <Line type="monotone" dataKey="m1" stroke="oklch(0.777 0.152 163.223)" strokeWidth={1.5} dot={false} name="M1" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Inflation bar chart (CPI YoY %) — colored by threshold (>3% red, >2% amber, else green). */
export function InflationBarChart({
  data,
  height = 300,
}: { data: MacroPoint[]; height?: number }) {
  if (!data.length) return <ChartEmpty height={height} />;
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={40} />
          <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
          <ReferenceLine y={2} stroke="oklch(0.777 0.152 163.223)" strokeDasharray="4 4" />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${Number(v).toFixed(2)}%`, "YoY"]} />
          <Bar dataKey="value">
            {data.map((p, i) => (
              <Cell
                key={i}
                fill={
                  p.value > 3
                    ? "oklch(0.704 0.191 22.216)"
                    : p.value > 2
                      ? "oklch(0.828 0.189 84.429)"
                      : "oklch(0.777 0.152 163.223)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center text-xs text-muted-foreground"
    >
      데이터 없음
    </div>
  );
}
