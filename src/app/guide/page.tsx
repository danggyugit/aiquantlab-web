import { NAV_SECTIONS } from "@/lib/nav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "가이드 · AI Quant Lab" };

const FEATURE_DESCRIPTIONS: Record<string, string> = {
  "/": "실시간 시장 스냅샷과 주요 기능 진입점",
  "/dashboard": "SPY·VIX·원자재·섹터·시장 폭까지 한눈에 보는 종합 대시보드",
  "/heatmap": "S&P500 시가총액 상위 60 종목 트리맵 + 11개 SPDR 섹터 성과",
  "/macro": "FRED 기반 미국 거시경제 지표 (금리·유동성·인플레이션·상품)",
  "/sentiment": "VIX 기반 공포&탐욕 지수, 뉴스 감정 분석",
  "/calendar": "경제지표·어닝 발표 캘린더",
  "/stock": "개별 종목 상세 (캔들·재무·밸류·뉴스·인사이더)",
  "/screener": "펀더멘털 조건 스크리너 (Finviz 스타일)",
  "/rs-screener": "IBD RS Rating 기반 상대강도 스크리너",
  "/breakout-screener": "월봉 추세채널 돌파 종목 스캔",
  "/compare": "2~5개 종목 성과·펀더멘털 비교",
  "/watchlist": "지수·섹터·원자재·개별주 관심 리스트",
  "/ai-quant-lab": "LLM 기반 리서치 워크벤치 + ML 백테스트 (플래그십)",
  "/factor-lab": "가치·모멘텀·저변동성 팩터 백테스트 (PIT + 21일 embargo)",
  "/stock-lab": "AI 종목 리포트 서비스 (외부 도메인)",
  "/sec-intelligence": "13F/Form4 파싱 + 고래 포트폴리오 + AI 공시 요약",
  "/portfolio": "실거래 기반 포트폴리오 추적·성과·세금 관리",
  "/guide": "이 페이지",
};

export default function GuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">가이드</h1>
        <p className="text-sm text-muted-foreground">
          AI Quant Lab의 모든 기능을 카테고리별로 안내합니다.
          <br className="hidden sm:block" />
          현재 웹 SPA는 이식 진행 중이며, 완성된 기능은 정상 사용 가능, 나머지는 Streamlit 원본으로 안내됩니다.
        </p>
      </header>

      {NAV_SECTIONS.map((section) => (
        <section key={section.label}>
          <h2 className="mb-3 text-lg font-semibold">{section.label}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {section.items.map((item) => (
              <Link key={item.href} href={item.href} className="block">
                <Card className="h-full transition-all hover:-translate-y-0.5 hover:border-primary/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-primary/10 p-1.5">
                          <item.icon className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-base">{item.label}</CardTitle>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.premium && (
                          <Badge variant="secondary" className="bg-premium/20 text-premium text-[10px]">
                            PRO
                          </Badge>
                        )}
                        {item.wip && (
                          <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 text-[10px]">
                            WIP
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {FEATURE_DESCRIPTIONS[item.href] ?? ""}
                    </p>
                    <div className="flex items-center gap-1 text-xs font-medium text-primary">
                      열기 <ArrowRight className="h-3 w-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <footer className="mt-4 rounded-lg border border-border/40 bg-card/40 p-4 text-xs text-muted-foreground">
        <p>
          <strong className="text-foreground">데이터 출처</strong>: yfinance, SEC EDGAR, Finnhub, FRED, Wikipedia
          (S&amp;P500 멤버십). 캐시는 stock-dashboard repo GitHub raw로 15분 TTL 로드.
        </p>
        <p className="mt-2">
          <strong className="text-foreground">Disclaimer</strong>: 본 서비스는 정보 제공 목적이며 투자 자문이
          아닙니다. 모든 투자 결정은 본인 책임입니다.
        </p>
      </footer>
    </div>
  );
}
