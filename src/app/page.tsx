import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  FlaskConical,
  Landmark,
  LineChart,
  ScanSearch,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { getHeatmap, getMarketSnapshot, latestQuote } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FinvizHeatmap, type FinvizTicker } from "@/components/finviz-heatmap";
import { IndexMiniChart } from "@/components/index-mini-chart";
import { cn } from "@/lib/utils";

export const metadata = { title: "AI Quant Lab · 홈" };
export const revalidate = 900;

const FEATURES = [
  { href: "/heatmap", icon: BarChart3, title: "히트맵", desc: "섹터·시가총액 등락 시각화" },
  { href: "/screener", icon: ScanSearch, title: "스크리너", desc: "펀더멘털 · RS · 돌파 3종 통합" },
  { href: "/backtest", icon: FlaskConical, title: "백테스트", desc: "룰 기반 실행 + AI 앙상블 프리셋", premium: true },
  { href: "/sec-intelligence", icon: Landmark, title: "SEC Intelligence", desc: "13F 헤지펀드 컨센서스" },
  { href: "/stock", icon: LineChart, title: "종목 상세", desc: "리서치 · 재무 · 차트" },
  { href: "/watchlist", icon: Star, title: "관심목록", desc: "가격 알림 · 카테고리" },
];

/**
 * Home = landing + market snapshot (merged with former /dashboard).
 *  1. Hero
 *  2. Market Indices (SPY · VIX · Gold · Oil from cache)
 *  3. Heatmap treemap (top 60 by market cap)
 *  4. Feature grid → 6 CTAs
 */
export default async function Home() {
  const [snapshot, heatmap] = await Promise.all([getMarketSnapshot(), getHeatmap()]);

  // Build indices from snapshot history (added by fetch_cache.build_market_snapshot).
  // Each `hist` is a 90-day array of {date, close} — mini charts consume the last 30.
  const toMini = (hist: Array<{ date: string; close: number }> | undefined) =>
    (hist ?? []).slice(-30).map((p) => ({ t: p.date, v: p.close }));

  const spyHist = toMini(snapshot.breadth.history);
  const vixHist = toMini(snapshot.vix.history);
  const goldHist = toMini(snapshot.commodities.gold.history);
  const oilHist = toMini(snapshot.commodities.oil_wti.history);

  const spyPrice = snapshot.breadth.spy_close;
  const spyChangePct =
    ((snapshot.breadth.spy_close - snapshot.breadth.sma200) / snapshot.breadth.sma200) * 100;
  const vixChangePct = ((snapshot.vix.current - snapshot.vix.avg) / snapshot.vix.avg) * 100;

  const indices = [
    { label: "S&P 500 (SPY)", value: spyPrice.toLocaleString(), changePct: spyChangePct, mini: spyHist },
    { label: "VIX",           value: snapshot.vix.current.toFixed(2), changePct: vixChangePct, mini: vixHist },
    {
      label: "Gold",
      value: snapshot.commodities.gold.current.toLocaleString(),
      changePct:
        ((snapshot.commodities.gold.current - snapshot.commodities.gold.avg) /
          snapshot.commodities.gold.avg) * 100,
      mini: goldHist,
    },
    {
      label: "WTI Oil",
      value: snapshot.commodities.oil_wti.current.toFixed(2),
      changePct:
        ((snapshot.commodities.oil_wti.current - snapshot.commodities.oil_wti.avg) /
          snapshot.commodities.oil_wti.avg) * 100,
      mini: oilHist,
    },
  ];

  // Top 200 by market cap grouped by sector — matches Finviz layout density.
  const heatmapNodes: FinvizTicker[] = Object.entries(heatmap.tickers)
    .map(([ticker, data]) => {
      const q = latestQuote(data);
      if (!q || !data.sector || !data.market_cap) return null;
      return {
        ticker,
        sector: data.sector,
        marketCap: data.market_cap,
        changePct: q.changePct,
      } satisfies FinvizTicker;
    })
    .filter((x): x is FinvizTicker => x !== null)
    .sort((a, b) => b.marketCap - a.marketCap)
    .slice(0, 200);

  const updatedAt = new Date(snapshot.updated_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6">
      {/* Hero */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI Quant Lab</h1>
          <MarketBadge />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          미국 주식 통합 리서치·퀀트 분석 웹앱 · 실시간 시장 · 팩터 백테스트 · 13F 컨센서스
        </p>
        <p className="text-[11px] text-muted-foreground">Updated {updatedAt} KST</p>
      </header>

      {/* Market Indices */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Market Indices</h2>
          <Badge variant="secondary" className="text-[10px]">자동 갱신 15분</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {indices.map((idx) => (
            <MetricTile key={idx.label} {...idx} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {indices.map((idx) => (
            <Card key={idx.label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-[10px] font-medium text-muted-foreground">
                  {idx.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {idx.mini.length > 1 ? (
                  <IndexMiniChart data={idx.mini} isUp={idx.changePct >= 0} />
                ) : (
                  <div className="flex h-[80px] items-center justify-center text-[10px] text-muted-foreground">
                    히스토리 없음
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Heatmap */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Market Heatmap</h2>
          <Link href="/heatmap" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            상세 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <FinvizHeatmap data={heatmapNodes} height={520} />
        <p className="mt-2 text-[10px] text-muted-foreground">
          섹터별 그룹 · 박스 크기 = 시가총액 · 색상 = 전일 대비 · 상위 200 종목 · 클릭 시 상세 이동
        </p>
      </section>

      {/* Backtest CTA (flagship) */}
      <section>
        <Link href="/backtest" className="block">
          <Card className="aiql-premium-glow border-premium/40 bg-gradient-to-br from-premium/[0.12] to-primary/[0.12] transition-transform hover:-translate-y-0.5">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-premium/20 p-2">
                    <Sparkles className="h-5 w-5 text-premium" />
                  </div>
                  <div>
                    <CardTitle className="aiql-gradient-text text-xl">백테스트 워크벤치</CardTitle>
                    <CardDescription className="mt-0.5">
                      20+ 룰 기반 팩터 실시간 실행 + AI 앙상블 50개 프리셋
                    </CardDescription>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  ★ PRO
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                시작하기 <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Feature grid */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">주요 기능</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href}>
              <Card
                className={cn(
                  "h-full transition-all hover:-translate-y-0.5 hover:border-primary/50",
                  f.premium && "border-premium/30",
                )}
              >
                <CardHeader className="pb-3">
                  <div
                    className={cn(
                      "mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg",
                      f.premium ? "bg-premium/15" : "bg-primary/10",
                    )}
                  >
                    <f.icon className={cn("h-5 w-5", f.premium ? "text-premium" : "text-primary")} />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription className="text-xs">{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-6 flex flex-col items-start gap-2 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} AI Quant Lab · Data as-is, not investment advice.</span>
        <div className="flex items-center gap-3">
          <Link href="/guide" className="hover:text-foreground">가이드</Link>
          <a
            href="https://github.com/danggyugit/aiquantlab-web"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

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
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
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
