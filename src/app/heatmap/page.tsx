import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getHeatmap, getMarketSnapshot, latestQuote, fmtMarketCap } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { SectorStrip } from "@/components/sector-strip";
import { FinvizHeatmap, type FinvizTicker } from "@/components/finviz-heatmap";
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
  const [snapshot, heatmap] = await Promise.all([
    getMarketSnapshot(),
    getHeatmap(),
  ]);

  // Compute enriched ticker rows
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

  // Section 3: Finviz-style heatmap (top-500 by market cap for the standalone page)
  const nodes: FinvizTicker[] = [...enriched]
    .filter((e) => e.sector && e.marketCap > 0)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 500)
    .map((e) => ({
      ticker: e.ticker,
      sector: e.sector,
      marketCap: e.marketCap,
      changePct: e.changePct,
    }));

  // Section 4: Sector Summary (Streamlit's dataframe)
  const sectorMap = new Map<
    string,
    { count: number; sumChange: number; totalCap: number }
  >();
  for (const e of enriched) {
    const cur = sectorMap.get(e.sector) ?? { count: 0, sumChange: 0, totalCap: 0 };
    cur.count += 1;
    cur.sumChange += e.changePct;
    cur.totalCap += e.marketCap;
    sectorMap.set(e.sector, cur);
  }
  const sectorSummary = Array.from(sectorMap.entries())
    .map(([sector, v]) => ({
      sector,
      count: v.count,
      avgChangePct: v.sumChange / v.count,
      totalCap: v.totalCap,
    }))
    .sort((a, b) => b.totalCap - a.totalCap);

  // Section 5: Top Movers (10 gainers, 10 losers)
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

      {/* ═══ 2. Period + View Mode (visual only — Streamlit's selectbox/radio) ═══ */}
      <section className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Period
        </span>
        <div className="flex gap-1">
          {["1d", "1w", "1m", "3m", "ytd", "1y"].map((p) => (
            <button
              key={p}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                p === "1d"
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-border/40 text-muted-foreground",
              )}
              title="캐시 확장 후 활성화 예정"
              disabled={p !== "1d"}
            >
              {p}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">
          현재는 전일 대비(1d)만 지원
        </span>
      </section>

      {/* ═══ 3. Sector Performance strip (기존 유지) ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Sector Performance</h2>
        <SectorStrip sectors={snapshot.sectors} />
      </section>

      {/* ═══ 4. Finviz-style Heatmap ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Market Heatmap</h2>
        <FinvizHeatmap data={nodes} height={900} />
        <p className="mt-2 text-[10px] text-muted-foreground">
          섹터별 그룹 · 박스 크기 = 시가총액 · 색상 = 전일 대비 등락 · 상위 300 종목 · 클릭 시 상세 이동
        </p>
      </section>

      {/* ═══ 5. Sector Summary (Streamlit's dataframe) ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Sector Summary</h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Sector</th>
                  <th className="px-3 py-2 text-right">종목 수</th>
                  <th className="px-3 py-2 text-right">평균 변화율</th>
                  <th className="px-3 py-2 text-right">총 시가총액</th>
                </tr>
              </thead>
              <tbody>
                {sectorSummary.map((s) => (
                  <tr key={s.sector} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 font-semibold">{s.sector}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums font-semibold",
                        s.avgChangePct >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {s.avgChangePct >= 0 ? "+" : ""}
                      {s.avgChangePct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {fmtMarketCap(s.totalCap)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ═══ 6. Top Movers ═══ */}
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
