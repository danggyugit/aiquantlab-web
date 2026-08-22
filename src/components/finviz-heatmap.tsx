"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/**
 * Finviz-style market map:
 *  - Squarified treemap at TWO levels (sectors → tickers within sector)
 *  - Cells sized by market cap, colored by daily % change
 *  - Sector header shows cap-weighted average % change
 *  - Cells link to /stock/[ticker]
 *
 * Layout uses Bruls-Huijse-van Wijk squarified algorithm at each level so
 * both sectors AND tickers get near-square aspect ratios — this is what
 * lets Finviz pack ~500 tickers into one screen with readable labels,
 * unlike a naive "one row per sector" stack (which crushes small sectors
 * into invisible slivers and wastes horizontal space in big sectors).
 */

export type FinvizTicker = {
  ticker: string;
  sector: string;
  marketCap: number;
  changePct: number;
};

type Rect = { x: number; y: number; w: number; h: number };
type Item = { id: string; area: number };
type Placed = { id: string } & Rect;

// ── Color scale (Finviz-style) ────────────────────────────────────

function colorFor(pct: number): string {
  // Saturates around ±3%. Near-zero is deliberately dark (not gray) so cells
  // look like Finviz's "flat" state instead of washed-out.
  const clamped = Math.max(-3, Math.min(3, pct));
  const t = Math.abs(clamped) / 3;
  if (Math.abs(pct) < 0.05) {
    return "rgb(38, 44, 55)"; // near-zero → dark slate
  }
  if (pct >= 0) {
    // Green: (30, 92, 66) at low → (34, 197, 94) at max
    const r = Math.round(30 + t * 4);
    const g = Math.round(92 + t * 105);
    const b = Math.round(66 + t * 28);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Red: (94, 42, 46) at low → (220, 38, 38) at max
    const r = Math.round(94 + t * 126);
    const g = Math.round(42 - t * 4);
    const b = Math.round(46 - t * 8);
    return `rgb(${r}, ${g}, ${b})`;
  }
}

// ── Squarified treemap algorithm ─────────────────────────────────

function worstRatio(row: Item[], side: number): number {
  if (row.length === 0) return Infinity;
  let sum = 0;
  let maxA = -Infinity;
  let minA = Infinity;
  for (const r of row) {
    sum += r.area;
    if (r.area > maxA) maxA = r.area;
    if (r.area < minA) minA = r.area;
  }
  const s2 = side * side;
  const sum2 = sum * sum;
  return Math.max((s2 * maxA) / sum2, sum2 / (s2 * minA));
}

function layoutRow(row: Item[], rect: Rect, out: Placed[]): Rect {
  const totalArea = row.reduce((s, i) => s + i.area, 0);
  const shorter = Math.min(rect.w, rect.h);
  if (shorter <= 0 || totalArea <= 0) return rect;
  const stripLen = totalArea / shorter;

  let offset = 0;
  if (rect.w >= rect.h) {
    // Shorter side is height. Strip runs vertically at the left edge.
    // Items stack top-to-bottom, each occupies full stripLen width.
    for (const item of row) {
      const h = item.area / stripLen;
      out.push({ id: item.id, x: rect.x, y: rect.y + offset, w: stripLen, h });
      offset += h;
    }
    return { x: rect.x + stripLen, y: rect.y, w: rect.w - stripLen, h: rect.h };
  } else {
    // Shorter side is width. Strip runs horizontally at the top edge.
    for (const item of row) {
      const w = item.area / stripLen;
      out.push({ id: item.id, x: rect.x + offset, y: rect.y, w, h: stripLen });
      offset += w;
    }
    return { x: rect.x, y: rect.y + stripLen, w: rect.w, h: rect.h - stripLen };
  }
}

function squarify(items: Item[], rect: Rect): Placed[] {
  const result: Placed[] = [];
  if (items.length === 0 || rect.w <= 0 || rect.h <= 0) return result;

  const totalArea = items.reduce((s, i) => s + i.area, 0);
  if (totalArea <= 0) return result;

  // Scale item areas so they collectively fill the rect exactly.
  const scale = (rect.w * rect.h) / totalArea;
  const sorted = items
    .filter((i) => i.area > 0)
    .map((i) => ({ id: i.id, area: i.area * scale }))
    .sort((a, b) => b.area - a.area);

  let current = { ...rect };
  let row: Item[] = [];
  let idx = 0;

  while (idx < sorted.length) {
    const side = Math.min(current.w, current.h);
    if (side <= 0) break;

    const next = sorted[idx];
    const trial = [...row, next];
    if (row.length === 0 || worstRatio(trial, side) <= worstRatio(row, side)) {
      row = trial;
      idx++;
    } else {
      current = layoutRow(row, current, result);
      row = [];
    }
  }
  if (row.length > 0) layoutRow(row, current, result);

  return result;
}

// ── Component ────────────────────────────────────────────────────

type SectorGroup = {
  sector: string;
  totalCap: number;
  weightedChange: number;
  tickers: FinvizTicker[];
};

const HEADER_H = 20;

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.abs(w - width) > 4) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layout = useMemo(() => {
    // Group tickers by sector
    const map = new Map<string, SectorGroup>();
    for (const t of data) {
      if (!t.sector || t.marketCap <= 0) continue;
      let g = map.get(t.sector);
      if (!g) {
        g = { sector: t.sector, totalCap: 0, weightedChange: 0, tickers: [] };
        map.set(t.sector, g);
      }
      g.totalCap += t.marketCap;
      g.weightedChange += t.marketCap * t.changePct;
      g.tickers.push(t);
    }
    const groups = Array.from(map.values());

    // Level 1: squarify sectors within the canvas
    const sectorRects = squarify(
      groups.map((g) => ({ id: g.sector, area: g.totalCap })),
      { x: 0, y: 0, w: width, h: height },
    );

    // Level 2: for each sector rectangle, squarify its tickers inside (below header)
    type CellLayout = {
      sector: string;
      sectorRect: Rect;
      avgChange: number;
      tickerRects: Array<Placed & { changePct: number }>;
    };
    const cells: CellLayout[] = [];

    for (const sr of sectorRects) {
      const g = map.get(sr.id)!;
      const innerH = Math.max(0, sr.h - HEADER_H);
      const inner: Rect = { x: sr.x, y: sr.y + HEADER_H, w: sr.w, h: innerH };
      const tickerRects = squarify(
        g.tickers.map((t) => ({ id: t.ticker, area: t.marketCap })),
        inner,
      ).map((r) => {
        const t = g.tickers.find((x) => x.ticker === r.id)!;
        return { ...r, changePct: t.changePct };
      });
      cells.push({
        sector: sr.id,
        sectorRect: sr,
        avgChange: g.weightedChange / g.totalCap,
        tickerRects,
      });
    }
    return cells;
  }, [data, width, height]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-[rgb(15,20,30)]"
      style={{ height: `${height}px` }}
    >
      {layout.map(({ sector, sectorRect, avgChange, tickerRects }) => {
        const showSectorHeader = sectorRect.w > 60 && sectorRect.h > HEADER_H + 4;
        return (
          <div key={sector}>
            {/* Sector header */}
            {showSectorHeader && (
              <div
                className="absolute z-[1] flex items-center justify-between overflow-hidden px-1.5 font-bold uppercase tracking-wide text-white"
                style={{
                  left: sectorRect.x,
                  top: sectorRect.y,
                  width: sectorRect.w,
                  height: HEADER_H,
                  background: "rgba(0,0,0,0.55)",
                  fontSize: 10,
                  letterSpacing: "0.05em",
                }}
              >
                <span className="truncate">{sector}</span>
                <span
                  className="ml-1.5 shrink-0 tabular-nums"
                  style={{ color: avgChange >= 0 ? "rgb(74, 222, 128)" : "rgb(248, 113, 113)" }}
                >
                  {avgChange >= 0 ? "+" : ""}{avgChange.toFixed(2)}%
                </span>
              </div>
            )}

            {/* Ticker cells */}
            {tickerRects.map((t) => {
              // Font size scales with cell dimensions — bigger cells get bigger labels.
              const minDim = Math.min(t.w, t.h);
              const tickerFont = Math.max(9, Math.min(28, Math.floor(minDim / 3.2)));
              const pctFont = Math.max(8, Math.min(16, Math.floor(minDim / 5.2)));
              const showTicker = t.w > 22 && t.h > 14;
              const showPct = t.w > 42 && t.h > 32;

              const cell = (
                <div
                  className="absolute flex cursor-pointer flex-col items-center justify-center overflow-hidden text-center leading-tight text-white transition-[filter,z-index] hover:z-10 hover:brightness-125"
                  style={{
                    left: t.x,
                    top: t.y,
                    width: t.w,
                    height: t.h,
                    background: colorFor(t.changePct),
                    borderRight: "1px solid rgba(15,20,30,0.9)",
                    borderBottom: "1px solid rgba(15,20,30,0.9)",
                    // Give text a bit of shadow so light labels stay legible on saturated greens
                    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}
                  title={`${t.id} · ${t.changePct >= 0 ? "+" : ""}${t.changePct.toFixed(2)}%`}
                >
                  {showTicker && (
                    <span
                      className="font-bold"
                      style={{ fontSize: `${tickerFont}px`, lineHeight: 1 }}
                    >
                      {t.id}
                    </span>
                  )}
                  {showPct && (
                    <span
                      className="tabular-nums"
                      style={{ fontSize: `${pctFont}px`, lineHeight: 1.2, marginTop: 2 }}
                    >
                      {t.changePct >= 0 ? "+" : ""}{t.changePct.toFixed(2)}%
                    </span>
                  )}
                </div>
              );

              return linkPrefix ? (
                <Link
                  key={t.id}
                  href={`${linkPrefix}${t.id}`}
                  aria-label={`${t.id} ${t.changePct >= 0 ? "+" : ""}${t.changePct.toFixed(2)}%`}
                  style={{ display: "block" }}
                >
                  {cell}
                </Link>
              ) : (
                <div key={t.id}>{cell}</div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
