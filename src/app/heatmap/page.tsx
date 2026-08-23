import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getHeatmap, getMarketSnapshot, getStocksMeta, latestQuote, fmtMarketCap } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { HeatmapWithControls } from "@/components/heatmap-with-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "히트맵 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 3_Heatmap.py (318 lines):
 *   1. Cache Status header (updated timestamp + ticker count)
 *   2. Period + View Mode selector (client would handle — display 1d default)
 *   3. Main: Treemap (Card grid alternative view is a future toggle)
 *   4. Sector Summary — count + avg %change + total market cap
 *   5. Top Movers — Top 10 Gainers / Top 10 Losers (2-column)
 */
export default async function HeatmapPage() {
  const [snapshot, heatmap, stocks] = await Promise.all([
    getMarketSnapshot(),
    getHeatmap(),
    getStocksMeta(),
  ]);
  // ticker → industry lookup (stocks.json has industry; heatmap.json only has sector).
  const industryByTicker = new Map(stocks.map((s) => [s.ticker, s.industry]));

  // Compute enriched ticker rows (used for Sector Summary + Top Movers cards)
  const enriched = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const q = latestQuote(data);
      if (!q) return null;
      return {
        ticker,
        name: data.name,
        sector: data.sector,
        marketCap: data.market_cap,
        price: q.price,
        changePct: q.changePct,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Ticker inputs — pass ALL tickers with returns (client component slices
  // top-500 for the heatmap and uses the full set for industry aggregation).
  const tickerInputs = Object.entries(heatmap.tickers)
    .filter(([, data]) => data.sector && data.market_cap && data.returns)
    .map(([ticker, data]) => ({
      ticker,
      sector: data.sector,
      industry: industryByTicker.get(ticker) ?? null,
      marketCap: data.market_cap,
      returns: (data.returns ?? {}) as Record<string, number | null | undefined>,
    }));

  // Top Movers (10 gainers, 10 losers) — 1d based, uses latestQuote from cache prices
  // (Sector Summary + Industry Breakdown live inside HeatmapWithControls now)
  const gainers = [...enriched].sort((a, b) => b.changePct - a.changePct).slice(0, 10);
  const losers = [...enriched].sort((a, b) => a.changePct - b.changePct).slice(0, 10);

  const updatedAt = new Date(heatmap.updated_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">히트맵</h1>
          <MarketBadge />
        </div>
      </header>

      {/* ═══ 1. Cache Status ═══ */}
      <Card className="bg-muted/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
            <span>
              Cached: <strong className="text-foreground">{enriched.length.toLocaleString()}</strong> stocks
            </span>
            <span className="hidden sm:inline">·</span>
            <span>
              Updated: <strong className="text-foreground">{updatedAt}</strong> KST
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Auto-refresh: 15m
          </Badge>
        </CardContent>
      </Card>

      {/* ═══ 2. Period selector + Sector Performance + Market Heatmap
             + Sector Summary + Industry Breakdown (all period-aware) ═══ */}
      <HeatmapWithControls
        tickers={tickerInputs}
        sectors={snapshot.sectors}
        heatmapHeight={900}
        defaultPeriod="1d"
      />

      {/* ═══ 3. Top Movers ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Top Movers</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <MoverCard title="📈 Top 10 Gainers" rows={gainers} tone="success" />
          <MoverCard title="📉 Top 10 Losers" rows={losers} tone="destructive" />
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function MoverCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: Array<{
    ticker: string;
    name: string;
    price: number;
    changePct: number;
    marketCap: number;
  }>;
  tone: "success" | "destructive";
}) {
  const borderClass =
    tone === "success" ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive";
  const textClass = tone === "success" ? "text-success" : "text-destructive";
  const Icon = tone === "success" ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <Link
            key={r.ticker}
            href={`/stock/${r.ticker}`}
            className={cn(
              "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/30",
              borderClass,
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-primary">{r.ticker}</span>
                <span className="truncate text-muted-foreground">{r.name}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                ${r.price.toFixed(2)} · {fmtMarketCap(r.marketCap)}
              </div>
            </div>
            <div className={cn("flex items-center gap-1 tabular-nums font-bold", textClass)}>
              <Icon className="h-3 w-3" />
              {r.changePct >= 0 ? "+" : ""}
              {r.changePct.toFixed(2)}%
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
