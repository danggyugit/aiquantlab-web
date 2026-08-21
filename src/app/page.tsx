import Link from "next/link";
import { ArrowRight, BarChart3, LineChart, Sparkles, Star, TrendingUp } from "lucide-react";
import { MarketBadge } from "@/components/market-badge";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const FEATURES = [
  {
    href: "/heatmap",
    icon: BarChart3,
    title: "히트맵",
    desc: "섹터·시가총액 기준 실시간 등락 시각화",
  },
  {
    href: "/watchlist",
    icon: Star,
    title: "관심목록",
    desc: "지수·원자재·개별주를 카테고리별로 관찰",
  },
  {
    href: "/macro",
    icon: TrendingUp,
    title: "매크로",
    desc: "금리·환율·CPI 등 거시 지표 대시보드",
  },
  {
    href: "/screener",
    icon: LineChart,
    title: "스크리너",
    desc: "재무·기술적 조건 기반 종목 필터링",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10 sm:px-8">
      {/* Hero */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI Quant Lab</h1>
          <MarketBadge />
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          미국 주식 통합 리서치·퀀트 분석 웹앱. 실시간 시장 데이터, 팩터 분석, ML 기반 인사이트를 한 곳에서.
        </p>
        <div
          className="h-0.5 w-24 rounded-full"
          style={{ background: "linear-gradient(90deg, oklch(0.623 0.214 259.815), transparent)" }}
        />
      </header>

      {/* Market snapshot (placeholder data — will hook to API later) */}
      <section aria-labelledby="market-snapshot">
        <h2 id="market-snapshot" className="mb-3 text-lg font-semibold">
          Market Snapshot
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="S&P 500" value="5,842" change={0.62} />
          <MetricCard label="NASDAQ" value="18,974" change={0.91} />
          <MetricCard label="DOW" value="42,113" change={-0.12} />
          <MetricCard label="VIX" value="14.28" change={-3.44} />
        </div>
      </section>

      <Separator />

      {/* AI Quant Lab CTA — flagship feature */}
      <section aria-labelledby="ai-lab-cta">
        <Link href="/ai-quant-lab" className="block">
          <Card className="aiql-premium-glow border-premium/40 bg-gradient-to-br from-premium/[0.12] to-primary/[0.12] transition-transform hover:-translate-y-0.5">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-premium/20 p-2">
                    <Sparkles className="h-5 w-5 text-premium" />
                  </div>
                  <div>
                    <CardTitle id="ai-lab-cta" className="aiql-gradient-text text-xl">
                      AI Quant Lab
                    </CardTitle>
                    <CardDescription className="mt-0.5">
                      LLM 기반 리서치·퀀트 백테스트 워크벤치 (플래그십)
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
                시작하기
                <ArrowRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      {/* Feature grid */}
      <section aria-labelledby="features">
        <h2 id="features" className="mb-3 text-lg font-semibold">
          주요 기능
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Link key={f.href} href={f.href}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/50">
                <CardHeader>
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription className="text-xs">{f.desc}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-auto flex flex-col items-start gap-2 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} AI Quant Lab · Data provided as-is, not investment advice.
        </span>
        <div className="flex items-center gap-3">
          <Link href="/guide" className="hover:text-foreground">
            가이드
          </Link>
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
