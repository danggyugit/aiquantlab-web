"use client";

import { useMemo } from "react";
import Link from "next/link";

/**
 * Finviz-style market map: rows are sectors, cells within each row are
 * tickers sized by market cap and colored by daily % change.
 *
 * Uses a hand-rolled squarified layout (a very light version of the
 * treemap algorithm) instead of Recharts' <Treemap> because we need:
 *  - Two-level nesting (sector → ticker) with sector headers
 *  - Anchor tags on each cell (Recharts wraps everything in SVG)
 *  - Fluid re-layout that adapts to how many tickers are in each sector
 */

export type FinvizTicker = {
  ticker: string;
  sector: string;
  marketCap: number;
  changePct: number;
};

type SectorGroup = {
  sector: string;
  totalCap: number;
  totalWeightedChange: number; // weighted by market cap
  tickers: FinvizTicker[];
};

function colorFor(pct: number): string {
  // Divergent red/gray/green, ±3% saturates.
  const t = Math.min(Math.abs(pct) / 3, 1);
  const alpha = 0.20 + t * 0.75;
  if (Math.abs(pct) < 0.05) return "rgba(100,116,139,0.30)"; // near-zero → gray
  return pct >= 0
    ? `rgba(16, 185, 129, ${alpha.toFixed(2)})`
    : `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
}

/**
 * Squarified treemap layout within a sector's row.
 * Given a fixed width and height, greedily lays out boxes so each is
 * roughly square-ish (aspect ratio close to 1). Not perfect but very
 * close to Finviz look for the top ~30 stocks per sector.
 */
function layoutSector(
  tickers: FinvizTicker[],
  width: number,
  height: number,
): Array<FinvizTicker & { x: number; y: number; w: number; h: number }> {
  const totalCap = tickers.reduce((sum, t) => sum + t.marketCap, 0);
  if (totalCap === 0 || tickers.length === 0) return [];

  const totalArea = width * height;
  const boxes = tickers.map((t) => ({
    ...t,
    area: (t.marketCap / totalCap) * totalArea,
  }));

  const result: Array<FinvizTicker & { x: number; y: number; w: number; h: number }> = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowH = height;
  let rowW = width;
  let rowBoxes: typeof boxes = [];
  let horizontal = width >= height; // start with the longer side

  function flushRow() {
    if (rowBoxes.length === 0) return;
    const rowArea = rowBoxes.reduce((s, b) => s + b.area, 0);
    const shortSide = horizontal ? rowH : rowW;
    const longSide = rowArea / shortSide;
    let offset = 0;
    for (const b of rowBoxes) {
      const size = b.area / longSide;
      const box = horizontal
        ? { x: cursorX, y: cursorY + offset, w: longSide, h: size }
        : { x: cursorX + offset, y: cursorY, w: size, h: longSide };
      result.push({ ...b, ...box });
      offset += size;
    }
    if (horizontal) {
      cursorX += longSide;
      rowW -= longSide;
    } else {
      cursorY += longSide;
      rowH -= longSide;
    }
    rowBoxes = [];
    horizontal = rowW >= rowH;
  }

  function worstRatio(row: typeof boxes, side: number): number {
    if (row.length === 0) return Infinity;
    const sum = row.reduce((s, b) => s + b.area, 0);
    const maxA = Math.max(...row.map((b) => b.area));
    const minA = Math.min(...row.map((b) => b.area));
    const s2 = side * side;
    const sum2 = sum * sum;
    return Math.max((s2 * maxA) / sum2, sum2 / (s2 * minA));
  }

  for (const b of boxes) {
    const side = horizontal ? rowH : rowW;
    const nextRow = [...rowBoxes, b];
    if (rowBoxes.length === 0 || worstRatio(nextRow, side) <= worstRatio(rowBoxes, side)) {
      rowBoxes = nextRow;
    } else {
      flushRow();
      rowBoxes = [b];
    }
  }
  flushRow();
  return result;
}

/**
 * Outer layout: split the container vertically into sector rows,
 * each sized proportional to sector total market cap.
 */
export function FinvizHeatmap({
  data,
  height = 640,
  linkPrefix = "/stock/",
}: {
  data: FinvizTicker[];
  height?: number;
  /** Prefix appended with ticker to build the click destination. Empty string disables links. */
  linkPrefix?: string;
}) {
  const groups: SectorGroup[] = useMemo(() => {
    const map = new Map<string, SectorGroup>();
    for (const t of data) {
      if (!t.sector) continue;
      let g = map.get(t.sector);
      if (!g) {
        g = { sector: t.sector, totalCap: 0, totalWeightedChange: 0, tickers: [] };
        map.set(t.sector, g);
      }
      g.totalCap += t.marketCap;
      g.totalWeightedChange += t.marketCap * t.changePct;
      g.tickers.push(t);
    }
    // Sort tickers within each sector by market cap desc; sort sectors by total cap desc
    for (const g of map.values()) {
      g.tickers.sort((a, b) => b.marketCap - a.marketCap);
    }
    return Array.from(map.values()).sort((a, b) => b.totalCap - a.totalCap);
  }, [data]);

  const totalCap = groups.reduce((s, g) => s + g.totalCap, 0);
  const headerHeight = 22;

  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-border/40 bg-card/30"
      style={{ height: `${height}px` }}
    >
      <div className="flex h-full flex-col">
        {groups.map((g) => {
          const rowHeight = totalCap > 0 ? (g.totalCap / totalCap) * height : 0;
          if (rowHeight < 40) return null; // hide tiny sectors
          const boxes = layoutSector(g.tickers, 100, rowHeight - headerHeight); // 100 = %
          const avgChange = g.totalWeightedChange / g.totalCap;

          return (
            <div
              key={g.sector}
              className="relative border-t border-border/40 first:border-t-0"
              style={{ height: `${rowHeight}px` }}
            >
              {/* Sector header */}
              <div
                className="flex items-center justify-between px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  height: `${headerHeight}px`,
                  background: colorFor(avgChange),
                  color: "#F8FAFC",
                }}
              >
                <span className="truncate">{g.sector}</span>
                <span className="ml-2 shrink-0 tabular-nums">
                  {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
                </span>
              </div>
              {/* Ticker cells */}
              <div className="relative w-full" style={{ height: `${rowHeight - headerHeight}px` }}>
                {boxes.map((b) => {
                  const cell = (
                    <div
                      className="absolute flex flex-col items-center justify-center overflow-hidden border border-background/60 text-white transition-transform hover:z-10 hover:scale-105 hover:brightness-125"
                      style={{
                        left: `${b.x}%`,
                        top: `${b.y}px`,
                        width: `${b.w}%`,
                        height: `${b.h}px`,
                        background: colorFor(b.changePct),
                      }}
                      title={`${b.ticker} · ${b.changePct >= 0 ? "+" : ""}${b.changePct.toFixed(2)}%`}
                    >
                      {b.h > 26 && b.w > 3.5 && (
                        <span
                          className="pointer-events-none font-semibold leading-none"
                          style={{ fontSize: `${Math.min(14, Math.max(9, b.h / 4))}px` }}
                        >
                          {b.ticker}
                        </span>
                      )}
                      {b.h > 44 && b.w > 5 && (
                        <span
                          className="pointer-events-none mt-0.5 tabular-nums leading-none"
                          style={{ fontSize: `${Math.min(11, Math.max(8, b.h / 6))}px` }}
                        >
                          {b.changePct >= 0 ? "+" : ""}{b.changePct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                  return linkPrefix ? (
                    <Link key={b.ticker} href={`${linkPrefix}${b.ticker}`}>
                      {cell}
                    </Link>
                  ) : (
                    <div key={b.ticker}>{cell}</div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
