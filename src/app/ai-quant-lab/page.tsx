import Link from "next/link";
import { ArrowRight, Brain, LineChart, Sparkles, Zap } from "lucide-react";
import { getAllBacktestPresets } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "AI Quant Lab · 플래그십" };
export const revalidate = 900;

export default async function AiQuantLabPage() {
  const presets = await getAllBacktestPresets();
  const best = [...presets].sort((a, b) => (b.summary.cagr_pct ?? 0) - (a.summary.cagr_pct ?? 0))[0];
  const bestSharpe = [...presets].sort((a, b) => (b.summary.sharpe ?? 0) - (a.summary.sharpe ?? 0))[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="rounded-2xl border border-premium/40 bg-gradient-to-br from-premium/[0.15] via-primary/[0.10] to-transparent p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-premium/20 p-2.5">
              <Sparkles className="h-6 w-6 text-premium" />
            </div>
            <div>
              <h1 className="aiql-gradient-text text-2xl font-bold tracking-tight sm:text-3xl">AI Quant Lab</h1>
              <p className="mt-1 text-sm text-muted-foreground">LLM · ML 기반 리서치 워크벤치 (플래그십)</p>
            </div>
          </div>
          <MarketBadge />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-premium/20 text-premium">PRO</Badge>
          <Badge variant="secondary">PIT-safe backtest</Badge>
          <Badge variant="secondary">21-day embargo</Badge>
          <Badge variant="secondary">생존편향 보정</Badge>
        </div>
      </div>

      {/* Live backtest highlights */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          <LineChart className="mr-1 inline h-4 w-4 text-primary" />
          최근 백테스트 하이라이트
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Highlight
            label="최고 CAGR"
            title={best.name}
            value={`${best.summary.cagr_pct?.toFixed(1)}%`}
            tone="success"
            desc={best.description}
          />
          <Highlight
            label="최고 Sharpe"
            title={bestSharpe.name}
            value={bestSharpe.summary.sharpe?.toFixed(2) ?? "-"}
            tone="primary"
            desc={bestSharpe.description}
          />
        </div>
        <div className="mt-3">
          <Link
            href="/factor-lab"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            전체 프리셋 보기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Feature preview */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          <Brain className="mr-1 inline h-4 w-4 text-primary" />
          기능 로드맵
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FeatureCard
            title="LLM 리서치"
            desc="Claude·Gemini로 종목·섹터 자동 리포트 생성. 뉴스·재무·차트를 종합해 요약."
            status="구현 예정 (백엔드 도입 후)"
            icon={<Brain />}
          />
          <FeatureCard
            title="실시간 종목 추천"
            desc="ML 스코어링 상위 종목 랭킹 + 리밸런싱 알림 (Telegram Bot 연동)"
            status="구현 예정 (Turso + 백엔드 도입 후)"
            icon={<Zap />}
          />
          <FeatureCard
            title="ML 팩터 백테스트"
            desc="XGBoost·LightGBM·hmmlearn 기반 알파 팩터 검증"
            status="✅ Factor Lab에서 5개 프리셋 결과 제공 중"
            icon={<LineChart />}
            done
          />
          <FeatureCard
            title="레짐 감지"
            desc="HMM으로 시장 국면(위험선호/회피) 자동 판정, 현금 비중 조절"
            status="✅ 백테스트에 이미 반영 (Regime 프리셋)"
            icon={<Sparkles />}
            done
          />
        </div>
      </section>

      {/* CTA */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Factor Lab에서 실제 백테스트 결과를 확인해보세요</div>
            <div className="text-sm text-muted-foreground">
              5개 프리셋 · CAGR/Sharpe/MDD 상세 지표 · 최신 편입 종목
            </div>
          </div>
          <Link
            href="/factor-lab"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            열기 <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Highlight({
  label,
  title,
  value,
  desc,
  tone,
}: {
  label: string;
  title: string;
  value: string;
  desc: string;
  tone: "success" | "primary";
}) {
  const color =
    tone === "success" ? "border-success/30 bg-success/5 text-success" : "border-primary/30 bg-primary/5 text-primary";
  return (
    <Card className={cn("border", color)}>
      <CardHeader className="pb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      </CardHeader>
      <CardContent>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className={cn("mt-1 text-4xl font-bold tabular-nums", tone === "success" ? "text-success" : "text-primary")}>
          {value}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{desc}</div>
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  title,
  desc,
  status,
  icon,
  done,
}: {
  title: string;
  desc: string;
  status: string;
  icon: React.ReactNode;
  done?: boolean;
}) {
  return (
    <Card className={cn(done && "border-success/30 bg-success/5")}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className={cn("rounded-lg p-1.5", done ? "bg-success/20 text-success" : "bg-primary/10 text-primary")}>
            {icon}
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn("text-xs font-medium", done ? "text-success" : "text-amber-400")}>{status}</div>
      </CardContent>
    </Card>
  );
}
