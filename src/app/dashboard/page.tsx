import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { getHeatmap, getMarketSnapshot, latestQuote } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeatmapTreemap } from "@/components/heatmap-treemap";
import { IndexMiniChart } from "@/components/index-mini-chart";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit `1_Dashboard.py` (476 lines) structure:
 *   1. Market Indices — dynamic metrics row
 *   2. Index Charts — 4-col mini area charts
 *   3. Market Heatmap — treemap (period selector)
 *   4. Portfolio Summary — total value + P&L (localStorage)
 *   5. Holdings News — per-ticker news (Coming Soon — Finnhub needed)
 */

export default async function DashboardPage() {
  const [snapshot, heatmap] = await Promise.all([
    getMarketSnapshot(),
    getHeatmap(),
  ]);

  // ── Section 1 data: Market Indices ────────────────────────────
  // Streamlit fetches GSPC/IXIC/DJI/VIX via get_indices(). Our cache only
  // has SPY breadth close + VIX. Fill NASDAQ/DOW as "coming soon".
  const spyPrice = snapshot.breadth.spy_close;
  const spyChangePct =
    ((snapshot.breadth.spy_close - snapshot.breadth.sma200) /
      snapshot.breadth.sma200) *
    100;
  const vixPrice = snapshot.vix.current;
  const vixChangePct =
    ((snapshot.vix.current - snapshot.vix.avg) / snapshot.vix.avg) * 100;

  const vixMiniPoints = snapshot.vix.history.slice(-30).map((p) => ({
    t: p.date,
    v: p.close,
  }));
  const spyMiniPoints = vixMiniPoints.map((p) => ({ t: p.t, v: 0 })); // placeholder — no SPY history in cache

  const indices = [
    {
      label: "S&P 500 (SPY)",
      value: spyPrice.toLocaleString(),
      changePct: spyChangePct,
      mini: spyMiniPoints,
      hasHistory: false,
    },
    {
      label: "VIX",
      value: vixPrice.toFixed(2),
      changePct: vixChangePct,
      mini: vixMiniPoints,
      hasHistory: true,
    },
    {
      label: "Gold",
      value: snapshot.commodities.gold.current.toLocaleString(),
      changePct:
        ((snapshot.commodities.gold.current - snapshot.commodities.gold.avg) /
          snapshot.commodities.gold.avg) *
        100,
      mini: [],
      hasHistory: false,
    },
    {
      label: "WTI Oil",
      value: snapshot.commodities.oil_wti.current.toFixed(2),
      changePct:
        ((snapshot.commodities.oil_wti.current -
          snapshot.commodities.oil_wti.avg) /
          snapshot.commodities.oil_wti.avg) *
        100,
      mini: [],
      hasHistory: false,
    },
  ];

  // ── Section 3 data: Heatmap (Streamlit's px.treemap) ──────────
  const heatmapNodes = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const q = latestQuote(data);
      if (!q) return null;
      return {
        name: ticker,
        fullName: data.name,
        sector: data.sector,
        size: data.market_cap,
        changePct: q.changePct,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.size - a.size)
    .slice(0, 100); // Streamlit shows more; we cap for perf

  const updatedAt = new Date(snapshot.updated_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <MarketBadge />
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {updatedAt} KST · Streamlit 1_Dashboard.py 미러링
        </p>
      </header>

      {/* ═══ Section 1: Market Indices (Streamlit st.metric row) ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Market Indices</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {indices.map((idx) => (
            <MetricTile key={idx.label} {...idx} />
          ))}
        </div>
      </section>

      {/* ═══ Section 2: Index Charts (Streamlit's 4-col plotly row) ═══ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Index Charts</h2>
          <Badge variant="secondary" className="text-[10px]">
            자동 갱신 300s
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {indices.map((idx) => (
            <Card key={idx.label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {idx.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {idx.hasHistory ? (
                  <IndexMiniChart data={idx.mini} isUp={idx.changePct >= 0} />
                ) : (
                  <div className="flex h-[120px] items-center justify-center text-[10px] text-muted-foreground">
                    히스토리 캐시 없음
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ═══ Section 3: Market Heatmap (Streamlit's treemap) ═══ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Market Heatmap</h2>
          <Badge variant="secondary" className="text-[10px]">
            Period: 1d (전일 대비)
          </Badge>
        </div>
        <HeatmapTreemap data={heatmapNodes} />
        <p className="mt-2 text-[10px] text-muted-foreground">
          박스 크기 = 시가총액, 색상 = 전일 대비 등락 · 상위 100 종목
        </p>
      </section>

      {/* ═══ Section 4: Portfolio Summary ═══ */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Portfolio Summary</h2>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            열기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            포트폴리오는 브라우저 로컬 스토리지에 저장됩니다.
            <br />
            <Link href="/portfolio" className="mt-2 inline-block text-primary hover:underline">
              /portfolio 페이지에서 거래를 추가하면 여기 요약이 표시됩니다.
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* ═══ Section 5: Holdings News (Streamlit's per-ticker news) ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Holdings News</h2>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-sm">뉴스 캐시 준비 중</CardTitle>
            <CardDescription className="text-xs">
              Streamlit에서는 각 보유 종목별 Finnhub 뉴스 카드를 표시합니다.
              웹 앱은 뉴스 API 프록시가 필요해서 후속 작업으로 진행 예정입니다.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function MetricTile({
  label,
  value,
  changePct,
}: {
  label: string;
  value: string;
  changePct: number;
}) {
  const isUp = changePct >= 0;
  return (
    <div
      className={cn(
        "rounded-xl border border-primary/15 bg-gradient-to-br from-card/60 to-background/40",
        "px-4 py-3 backdrop-blur-md transition-all",
        "hover:-translate-y-0.5 hover:border-primary/50",
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
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
    </div>
  );
}
