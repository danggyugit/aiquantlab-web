"use client";

import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { IndexMiniChart } from "@/components/index-mini-chart";
import { fetchQuote } from "@/lib/finnhub";
import { cn } from "@/lib/utils";

/**
 * Home hero — 4 index tiles polled ~30s during US market hours.
 *
 * US market runs 09:30-16:00 ET. In KST that's roughly 22:30-05:00
 * (EDT) or 23:30-06:00 (EST). We over-approximate as 22:00-06:30 KST
 * so we always cover the open, and freeze at last-good otherwise.
 *
 * Fallback: initial values come from the server-cached market snapshot
 * (props). If polling fails or market is closed, we keep those values.
 */

export type IndexTile = {
  label: string;
  symbol: string;                // Finnhub quote symbol (e.g. "DIA", "^VIX")
  initialValue: number;
  initialChangePct: number;
  mini: Array<{ t: string; v: number }>;
  digits?: number;
};

function isUsMarketHoursKst(now = new Date()): boolean {
  // Convert to KST (UTC+9) — Date is already TZ-agnostic internally.
  const kstHour = (now.getUTCHours() + 9) % 24;
  const kstMinute = now.getUTCMinutes();
  const minutesOfDay = kstHour * 60 + kstMinute;
  const start = 22 * 60;         // 22:00
  const end = 6 * 60 + 30;       // 06:30 next day
  // Spans midnight → either >= start OR < end
  return minutesOfDay >= start || minutesOfDay < end;
}

export function IndexHero({ tiles }: { tiles: IndexTile[] }) {
  // Per-tile live state — starts from server values, gets updated by polling.
  const [live, setLive] = useState<Record<string, { value: number; changePct: number; ts: number } | null>>(
    () => Object.fromEntries(tiles.map((t) => [t.symbol, null])),
  );
  const [marketOpen, setMarketOpen] = useState<boolean>(() => isUsMarketHoursKst());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  useEffect(() => {
    async function pollAll() {
      const results = await Promise.all(
        tiles.map(async (t) => {
          const q = await fetchQuote(t.symbol);
          return q ? [t.symbol, { value: q.c, changePct: q.dp, ts: q.t }] as const : [t.symbol, null] as const;
        }),
      );
      setLive((prev) => {
        const next = { ...prev };
        for (const [sym, val] of results) {
          if (val !== null) next[sym] = val;
        }
        return next;
      });
      setNowTick(Date.now());
    }

    // Always poll ONCE on mount so the badge reflects live data even
    // right at market close boundaries.
    pollAll();

    // Then only keep polling if the market is open.
    const marketNow = isUsMarketHoursKst();
    setMarketOpen(marketNow);
    if (!marketNow) return;

    const id = setInterval(pollAll, 30_000);
    return () => clearInterval(id);
  // We intentionally use the symbol tuple as a stable dep — tiles is a
  // stable prop shape from the server component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles.map((t) => t.symbol).join(",")]);

  const lastUpdated = new Date(nowTick).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">주요 지수</h2>
        <div className="flex items-center gap-2 text-[10px]">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
              marketOpen
                ? "border border-success/40 bg-success/10 text-success"
                : "border border-border/40 bg-muted/30 text-muted-foreground",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", marketOpen ? "bg-success animate-pulse" : "bg-muted-foreground")} />
            {marketOpen ? "미장 개장" : "미장 마감"}
          </span>
          <span className="text-muted-foreground tabular-nums">{lastUpdated}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((t) => {
          const l = live[t.symbol];
          const value = l?.value ?? t.initialValue;
          const changePct = l?.changePct ?? t.initialChangePct;
          const isFresh = l !== null;
          return (
            <MetricTile
              key={t.symbol}
              label={t.label}
              value={value}
              changePct={changePct}
              digits={t.digits ?? 2}
              mini={t.mini}
              fresh={isFresh && marketOpen}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {marketOpen
          ? "30초마다 자동 갱신 · 시세 15분 지연 (Finnhub 무료 티어)"
          : "미장 마감 · 전일 종가 표시 · 개장 시 자동 갱신 재개"}
      </p>
    </section>
  );
}

function MetricTile({
  label,
  value,
  changePct,
  digits,
  mini,
  fresh,
}: {
  label: string;
  value: number;
  changePct: number;
  digits: number;
  mini: Array<{ t: string; v: number }>;
  fresh: boolean;
}) {
  const isUp = changePct >= 0;
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 backdrop-blur-md transition-all",
        "hover:-translate-y-0.5",
        fresh
          ? "border-primary/40 bg-gradient-to-br from-primary/[0.08] to-background/40 hover:border-primary/60"
          : "border-primary/15 bg-gradient-to-br from-card/60 to-background/40 hover:border-primary/50",
      )}
    >
      <div className="flex items-baseline justify-between">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {fresh && (
          <span className="text-[9px] font-mono text-primary/80">● LIVE</span>
        )}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">
        {digits === 0
          ? value.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : value.toFixed(digits)}
      </div>
      <div
        className={cn(
          "mt-0.5 flex items-center gap-1 text-xs font-semibold tabular-nums",
          isUp ? "text-success" : "text-destructive",
        )}
      >
        {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isUp ? "+" : ""}
        {changePct.toFixed(2)}%
      </div>
      {mini.length > 0 && (
        <div className="mt-1 -mb-1 h-8 opacity-70">
          <IndexMiniChart data={mini} isUp={isUp} />
        </div>
      )}
    </div>
  );
}
