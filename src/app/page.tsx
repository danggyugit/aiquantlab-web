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
import { getHeatmap, getMarketSnapshot, getRotationEval, latestQuote } from "@/lib/data";
import { getQuoteServer } from "@/lib/finnhub";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeatmapWithControls } from "@/components/heatmap-with-controls";
import { IndexHero, type IndexTile } from "@/components/index-hero";
import { cn } from "@/lib/utils";

export const metadata = { title: "AI Quant Lab · 홈" };
export const revalidate = 900;

const FEATURES = [
  { href: "/heatmap", icon: BarChart3, title: "히트맵", desc: "섹터·시가총액 등락 시각화" },
  { href: "/screener", icon: ScanSearch, title: "스크리너", desc: "RS 모멘텀 · 신고가 돌파 · 펀더멘털 3종 통합" },
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
  // Fetch initial hero quotes on the server so the tiles always render
  // a real value — during market hours it's the last quote (15min delayed
  // on Finnhub free tier), after hours it's the previous close from `pc`.
  // Prevents the "DIA 0.00" blank-tile UX when the client can't reach the
  // API (env-var missing, CORS blocked, browser offline, etc.).
  const [snapshot, heatmap, rotation, diaQuote, spyQuote, qqqQuote] = await Promise.all([
    getMarketSnapshot(),
    getHeatmap(),
    getRotationEval("ensemble"),
    getQuoteServer("DIA"),
    getQuoteServer("SPY"),
    getQuoteServer("QQQ"),
  ]);
  // ^VIX is a CFD index that Finnhub's free tier doesn't serve — we
  // always source VIX from the daily snapshot cache instead.

  // Build indices from snapshot history (added by fetch_cache.build_market_snapshot).
  // Each `hist` is a 90-day array of {date, close} — mini charts consume the last 30.
  const toMini = (hist: Array<{ date: string; close: number }> | undefined) =>
    (hist ?? []).slice(-30).map((p) => ({ t: p.date, v: p.close }));

  // Build initial values for the polling hero tiles.
  //   1. Prefer live-ish Finnhub /quote (server-side): during market hours
  //      shows current, after hours shows prev close via `pc` fallback.
  //   2. Snapshot from the daily cache if the quote call failed.
  //   3. Zero as last resort.
  const qqq = snapshot.global_indices?.qqq;
  const spyMini = toMini(snapshot.breadth.history);
  const vixMini = toMini(snapshot.vix.history);
  const qqqMini = toMini(qqq?.history);

  // Helper: current if we have a fresh quote, else fall back cleanly.
  const q = (quote: { c: number; dp: number; pc: number } | null, fallbackVal = 0, fallbackPct = 0) =>
    quote && quote.c > 0
      ? { value: quote.c, changePct: quote.dp }
      : { value: fallbackVal, changePct: fallbackPct };

  const vixChangePctInit = ((snapshot.vix.current - snapshot.vix.avg) / snapshot.vix.avg) * 100;

  const dia = q(diaQuote);
  const spy = q(spyQuote, snapshot.breadth.spy_close, 0);
  const qqqInit = q(qqqQuote, qqq?.current ?? 0, 0);

  const indexTiles: IndexTile[] = [
    { label: "Dow (DIA)",  symbol: "DIA",  initialValue: dia.value,             initialChangePct: dia.changePct,     mini: [],      digits: 2 },
    { label: "S&P 500",    symbol: "SPY",  initialValue: spy.value,             initialChangePct: spy.changePct,     mini: spyMini, digits: 2 },
    { label: "NASDAQ 100", symbol: "QQQ",  initialValue: qqqInit.value,         initialChangePct: qqqInit.changePct, mini: qqqMini, digits: 2 },
    { label: "VIX",        symbol: "^VIX", initialValue: snapshot.vix.current,  initialChangePct: vixChangePctInit,  mini: vixMini, digits: 2 },
  ];

  // Top 200 by market cap for the home heatmap (period selector uses backend returns)
  const heatmapNodes = Object.entries(heatmap.tickers)
    .filter(([, data]) => data.sector && data.market_cap && data.returns)
    .map(([ticker, data]) => ({
      ticker,
      sector: data.sector,
      marketCap: data.market_cap,
      returns: (data.returns ?? {}) as Record<string, number | null | undefined>,
    }))
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

      {/* Market Indices — polled ~30s during US market hours */}
      <IndexHero tiles={indexTiles} />

      {/* Global Indices + FX — cross-market snapshot */}
      {(snapshot.global_indices || snapshot.fx) && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Global Markets</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {snapshot.global_indices && Object.entries(snapshot.global_indices).slice(0, 6).map(([key, q]) => (
              <QuoteTile key={key} label={q.label} value={q.current} avg={q.avg} suffix="" digits={q.current > 1000 ? 0 : 2} />
            ))}
          </div>
          {snapshot.fx && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Object.entries(snapshot.fx).map(([key, q]) => (
                <QuoteTile key={key} label={q.label} value={q.current} avg={q.avg} suffix="" digits={q.current > 100 ? 1 : 4} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Heatmap (period-toggleable · sector strip + treemap) */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Market Heatmap</h2>
          <Link href="/heatmap" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            상세 보기 <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <HeatmapWithControls
          tickers={heatmapNodes}
          sectors={snapshot.sectors}
          heatmapHeight={620}
          heatmapLimit={200}
          showIndustryTable={false}
        />
      </section>

      {/* Today's sector rotation recommendation */}
      {rotation && <RotationBadge rotation={rotation} />}

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

function QuoteTile({
  label,
  value,
  avg,
  suffix = "",
  digits = 2,
}: {
  label: string;
  value: number;
  avg: number;
  suffix?: string;
  digits?: number;
}) {
  const pct = ((value - avg) / avg) * 100;
  const isUp = pct >= 0;
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-2.5 py-2">
      <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold tabular-nums">
        {digits === 0 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value.toFixed(digits)}{suffix}
      </div>
      <div className={cn("text-[10px] font-semibold tabular-nums", isUp ? "text-success" : "text-destructive")}>
        {isUp ? "+" : ""}{pct.toFixed(2)}%
      </div>
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

// Sector map for user-facing labels — mirrors BACKTEST_SECTORS keys.
const SECTOR_LABEL: Record<string, string> = {
  it: "IT", hc: "Health Care", fin: "Financials", cd: "Consumer Disc.",
  cs: "Comm. Services", ind: "Industrials", staples: "Consumer Stap.",
  en: "Energy", mat: "Materials", re: "Real Estate",
};

const ROTATION_RULE_LABEL: Record<string, string> = {
  mom_1m: "1M 모멘텀",
  mom_3m: "3M 모멘텀",
  conf: "모델 신뢰도",
};

function RotationBadge({
  rotation,
}: {
  rotation: import("@/lib/data").RotationEval;
}) {
  // Rank rules by their best-performing top1 variant's CAGR so the "best rule"
  // shown to users matches what the AI Lab tab surfaces as the leaderboard top.
  const bestRule =
    Object.entries(rotation.variants)
      .filter(([k]) => k.endsWith("_top1"))
      .sort(([, a], [, b]) => (b.summary.cagr_pct ?? 0) - (a.summary.cagr_pct ?? 0))[0]?.[0]
      ?.replace(/_top1$/, "");

  const rules = Object.keys(rotation.today_recommendation);
  if (rules.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">🔄 오늘의 섹터 로테이션 추천</h2>
        <Link href="/backtest" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          백테스트로 검증 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        10개 섹터의 앙상블 프리셋 결과를 3가지 룰로 후처리 · 매일 10:30 KST 자동 갱신
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {rules.map((rule) => {
          const ranked = rotation.today_recommendation[rule].slice(0, 3);
          const isBest = rule === bestRule;
          return (
            <Card
              key={rule}
              className={cn(
                "transition-colors",
                isBest && "border-primary/50 bg-primary/[0.04]",
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{ROTATION_RULE_LABEL[rule] ?? rule}</CardTitle>
                  {isBest && (
                    <Badge variant="secondary" className="bg-primary/15 text-primary text-[10px]">
                      최고 CAGR
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {ranked.map((r, i) => (
                  <div
                    key={r.sector}
                    className={cn(
                      "rounded-md border border-border/30 px-2 py-1.5",
                      i === 0 && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className={cn("text-xs font-semibold", i === 0 ? "text-primary" : "text-foreground")}>
                        {i + 1}. {SECTOR_LABEL[r.sector] ?? r.sector.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                        {r.score !== null && r.score !== undefined ? r.score.toFixed(3) : "-"}
                      </span>
                    </div>
                    {r.today_picks && r.today_picks.length > 0 && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                        {r.today_picks.slice(0, 5).join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
