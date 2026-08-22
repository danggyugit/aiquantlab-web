import { getMarketSnapshot } from "@/lib/data";
import { getMarketNews } from "@/lib/finnhub";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SectorStrip } from "@/components/sector-strip";
import { VixChart } from "@/app/macro/vix-chart";
import { cn } from "@/lib/utils";

export const metadata = { title: "센티먼트 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 6_Sentiment.py (581 lines):
 *   1. Fear & Greed gauge (left) + Component scores (right)
 *   2. VIX Trend chart + Market Breadth (2-col)
 *   3. Sector Returns + Risk-On/Off (2-col)
 *   4. Market News tabs (3-tab: Market / Stock / AI Analysis)
 *   5. Sector Rotation Map (RRG scatter — future)
 */

function vixToSentiment(vix: number): {
  label: string;
  score: number;
  color: string;
} {
  const score = Math.max(0, Math.min(100, 100 - ((vix - 12) / 18) * 80));
  let label: string;
  let color: string;
  if (score >= 75) { label = "Extreme Greed"; color = "text-success"; }
  else if (score >= 55) { label = "Greed"; color = "text-success/80"; }
  else if (score >= 45) { label = "Neutral"; color = "text-muted-foreground"; }
  else if (score >= 25) { label = "Fear"; color = "text-amber-400"; }
  else { label = "Extreme Fear"; color = "text-destructive"; }
  return { label, score: Math.round(score), color };
}

export default async function SentimentPage() {
  const [s, marketNews] = await Promise.all([
    getMarketSnapshot(),
    getMarketNews("general"),
  ]);
  const sentiment = vixToSentiment(s.vix.current);
  const vixHistory = s.vix.history.map((h) => ({ date: h.date.slice(5), close: h.close }));

  // Component scores (Streamlit shows 3: VIX / Momentum / Volume — we compute from what we have)
  const vixScore = sentiment.score;
  const breadthScore = Math.round(s.breadth.above_pct);
  const momentumScore = Math.round(
    Math.min(100, Math.max(0, 50 + (s.sectors[0]?.ret_1m_pct ?? 0) * 5)),
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">센티먼트</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          공포 &amp; 탐욕 지수 · VIX · 시장 폭 · 섹터 회전 · Streamlit 6_Sentiment.py 미러링
        </p>
      </header>

      {/* ═══ 1. Fear & Greed Gauge (left) + Components (right) ═══ */}
      <section>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fear &amp; Greed Index</CardTitle>
              <CardDescription className="text-xs">
                VIX 기반 시장 심리 (0=극단적 공포, 100=극단적 탐욕)
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 py-6">
              <div className="text-center">
                <div className={cn("text-6xl font-bold tabular-nums", sentiment.color)}>
                  {sentiment.score}
                </div>
                <div className={cn("mt-1 text-lg font-semibold", sentiment.color)}>
                  {sentiment.label}
                </div>
              </div>
              <div className="relative h-3 w-full max-w-md overflow-hidden rounded-full bg-gradient-to-r from-destructive via-amber-400 to-success">
                <div
                  className="absolute top-0 h-full w-1 bg-foreground shadow-lg"
                  style={{ left: `${sentiment.score}%`, transform: "translateX(-50%)" }}
                />
              </div>
              <div className="flex w-full max-w-md justify-between text-[10px] text-muted-foreground">
                <span>Extreme Fear</span>
                <span>Neutral</span>
                <span>Extreme Greed</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Component Scores</CardTitle>
              <CardDescription className="text-xs">지수 구성 요소별 개별 점수</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 py-4">
              <ComponentBar label="VIX (Volatility)" score={vixScore} />
              <ComponentBar label="Momentum (Sector 1M)" score={momentumScore} />
              <ComponentBar label="Breadth (% > SMA200)" score={breadthScore} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══ 2. VIX Trend + Market Breadth (2-col) ═══ */}
      <section>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">VIX Trend</CardTitle>
              <CardDescription className="text-xs">
                현재 {s.vix.current.toFixed(2)} · 6M 평균 {s.vix.avg.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VixChart data={vixHistory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Market Breadth</CardTitle>
              <CardDescription className="text-xs">
                S&amp;P 500 vs 200일 이평선 · 종목 비율 {s.breadth.above_pct}%
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 py-6">
              <div className="text-center">
                <div className="text-5xl font-bold tabular-nums text-primary">
                  {s.breadth.above_pct}%
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  200일선 위 종목 비율
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, s.breadth.above_pct))}%` }}
                />
              </div>
              <div className="text-center text-xs text-muted-foreground">
                {s.breadth.above_pct < 30
                  ? "약세 시장"
                  : s.breadth.above_pct < 50
                    ? "중립"
                    : "강세 시장"}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══ 3. Sector Returns + Risk-On/Off (2-col) ═══ */}
      <section>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Sector Returns</CardTitle>
              <CardDescription className="text-xs">11 SPDR 섹터 ETF (1W · 1M)</CardDescription>
            </CardHeader>
            <CardContent>
              <SectorStrip sectors={s.sectors} />
            </CardContent>
          </Card>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Risk-On / Risk-Off</CardTitle>
              <CardDescription className="text-xs">
                XLY / XLP 비율 (경기순환 vs 필수소비재)
              </CardDescription>
            </CardHeader>
            <CardContent className="py-6 text-center text-xs text-muted-foreground">
              XLY/XLP 시계열 데이터 캐시 확장 필요 · 후속 예정
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══ 4. Market News (3-tab: Market / Stock / AI Analysis) ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">News &amp; AI Analysis</h2>
        <Tabs defaultValue="market">
          <TabsList className="flex flex-wrap gap-1 bg-transparent p-0">
            <TabsTrigger
              value="market"
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Market News
            </TabsTrigger>
            <TabsTrigger
              value="stock"
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Stock News
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              AI Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Finnhub Market News</CardTitle>
                <CardDescription className="text-xs">
                  {marketNews?.length ?? 0}건 · 실시간 시장 헤드라인
                </CardDescription>
              </CardHeader>
              <CardContent>
                {marketNews && marketNews.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {marketNews.slice(0, 20).map((n, i) => (
                      <a
                        key={i}
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-lg border border-border/40 bg-card/40 p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="line-clamp-2 text-sm font-medium group-hover:text-primary">{n.headline}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Date(n.datetime * 1000).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                          </span>
                        </div>
                        {n.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>}
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{n.source}</span>
                          {n.category && <Badge variant="secondary" className="text-[9px]">{n.category}</Badge>}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Finnhub API가 미연결 상태입니다.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stock" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ticker News</CardTitle>
                <CardDescription className="text-xs">
                  종목별 뉴스는 <a href="/stock" className="text-primary hover:underline">종목 상세</a> 페이지에서 확인 가능합니다.
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="mt-4">
            <Card className="border-premium/30 bg-premium/5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">AI 리포트 생성</CardTitle>
                  <Badge variant="secondary" className="bg-premium/20 text-premium text-[10px]">
                    LLM
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Streamlit: Anthropic/Google LLM으로 뉴스 헤드라인 요약·투자 시사점 리포트 생성.
                API 통합 (백엔드 프록시 + LLM 키) 후 활성화.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* ═══ 5. Sector Rotation Map (RRG) - Future ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Sector Rotation Map (RRG)</h2>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4 text-xs text-muted-foreground">
            Streamlit 원본은 4-사분면 산점도 (Leading/Weakening/Lagging/Improving) 로 11개 섹터 ETF의 상대강도·모멘텀을 시각화합니다.
            SPDR 섹터별 90일 이상 시계열 캐시 확장 필요.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ComponentBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 75 ? "bg-success"
    : score >= 55 ? "bg-success/70"
    : score >= 45 ? "bg-muted-foreground"
    : score >= 25 ? "bg-amber-400"
    : "bg-destructive";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold tabular-nums">{score}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/40">
        <div className={cn("h-full", color)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
