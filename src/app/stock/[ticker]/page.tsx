import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import {
  distanceFromHigh,
  fmtMarketCap,
  getFundamentals,
  getHeatmap,
  getStocksMeta,
  latestQuote,
} from "@/lib/data";
import { getCompanyNews, getPriceTarget, getRecommendation } from "@/lib/finnhub";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "./price-chart";
import { TradingViewWidget } from "./tradingview-widget";
import { StockActions } from "./actions";
import { cn } from "@/lib/utils";

export const revalidate = 900;

type PageProps = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { ticker } = await params;
  return { title: `${ticker.toUpperCase()} · AI Quant Lab` };
}

/**
 * Mirrors Streamlit 4_Stock_Detail.py — LINEAR page (no tabs):
 *   1. Header: logo · name · 5 key metrics + 52W range bar
 *   2. Chart: TradingView embed (fallback: Plotly candles)
 *   3. Valuation: AI scenarios · Analyst consensus · Multi-PER table
 *   4. Financial metrics: 8 metrics (2×4)
 *   5. Fundamentals grid: 8 metrics
 *   6. News (10 latest, sentiment badges)
 *   7. Earnings surprise history (bar chart + 3 metrics)
 *   8. Insider trading (SEC Form 4)
 *   9. AI earnings summary (Gemini)
 *   10. Company about (expander)
 */

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();

  const [heatmap, fund, stocks, news, priceTarget, recommendation] = await Promise.all([
    getHeatmap(),
    getFundamentals(),
    getStocksMeta(),
    getCompanyNews(ticker, 14),
    getPriceTarget(ticker),
    getRecommendation(ticker),
  ]);

  const meta = stocks.find((s) => s.ticker === ticker);
  const priceData = heatmap.tickers[ticker];
  const fundamentals = fund.tickers[ticker];

  if (!meta || !priceData) notFound();

  const quote = latestQuote(priceData);
  const highDist = fundamentals
    ? distanceFromHigh(quote?.price ?? 0, fundamentals.fifty_two_week_high)
    : null;

  const chartData = priceData.prices.map((p) => ({
    date: p.date.slice(5),
    close: p.close,
    high: p.high,
    low: p.low,
    volume: p.volume,
  }));

  // 52W range position (0-100%)
  const rangePct = fundamentals?.fifty_two_week_high && fundamentals.fifty_two_week_low && quote
    ? ((quote.price - fundamentals.fifty_two_week_low) /
        (fundamentals.fifty_two_week_high - fundamentals.fifty_two_week_low)) * 100
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <Link href="/stock" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> 종목 검색으로
        </Link>
        <header className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="font-mono">{ticker}</span>{" "}
              <span className="text-lg font-normal text-muted-foreground sm:text-xl">{meta.name}</span>
            </h1>
            <MarketBadge />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{meta.sector}</Badge>
            <Badge variant="secondary" className="text-muted-foreground">{meta.industry}</Badge>
            <Badge variant="secondary" className="text-muted-foreground">{meta.cap_tier}</Badge>
          </div>
          <StockActions ticker={ticker} price={quote?.price} />
        </header>
      </div>

      {/* ═══ 1. Header Metrics (5 key metrics — Streamlit's st.columns(5)) ═══ */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-5">
          <KeyMetric
            label="현재가"
            value={quote ? `$${quote.price.toFixed(2)}` : "-"}
            change={quote?.changePct}
          />
          <KeyMetric label="시가총액" value={priceData.market_cap ? fmtMarketCap(priceData.market_cap) : "-"} />
          <KeyMetric label="P/E" value={fundamentals?.pe_ratio && fundamentals.pe_ratio > 0 ? fundamentals.pe_ratio.toFixed(1) : "-"} />
          <KeyMetric label="52주 고가" value={fundamentals?.fifty_two_week_high ? `$${fundamentals.fifty_two_week_high.toFixed(2)}` : "-"} />
          <KeyMetric label="52주 저가" value={fundamentals?.fifty_two_week_low ? `$${fundamentals.fifty_two_week_low.toFixed(2)}` : "-"} />
        </CardContent>
      </Card>

      {/* 52W range slider bar */}
      {rangePct !== null && fundamentals?.fifty_two_week_low && fundamentals?.fifty_two_week_high && (
        <div className="rounded-lg border border-border/40 bg-card/40 p-4">
          <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
            <span>${fundamentals.fifty_two_week_low.toFixed(2)}</span>
            <span className="font-semibold text-foreground">52W Range: {rangePct.toFixed(0)}%</span>
            <span>${fundamentals.fifty_two_week_high.toFixed(2)}</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-gradient-to-r from-destructive via-amber-400 to-success">
            <div
              className="absolute top-0 h-full w-1 bg-foreground shadow-lg"
              style={{ left: `${rangePct}%`, transform: "translateX(-50%)" }}
            />
          </div>
        </div>
      )}

      {/* ═══ 2. Chart — TradingView Advanced Chart widget ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">가격 차트</CardTitle>
          <CardDescription className="text-xs">
            TradingView 임베드 · 인디케이터 · 드로잉 · 여러 봉 지원
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TradingViewWidget symbol={ticker} />
        </CardContent>
      </Card>

      {/* Cache-based mini area chart (fallback / quick reference) */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">캐시 기반 미니 차트 ({chartData.length}일)</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChart data={chartData} />
          </CardContent>
        </Card>
      )}

      {/* ═══ 3. Analyst consensus (Finnhub) ═══ */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">애널리스트 컨센서스</h2>
        {priceTarget ? (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KeyMetric label="목표가 (중앙값)" value={`$${priceTarget.targetMedian.toFixed(2)}`} />
                <KeyMetric
                  label="평균"
                  value={`$${priceTarget.targetMean.toFixed(2)}`}
                  change={quote ? ((priceTarget.targetMean - quote.price) / quote.price) * 100 : undefined}
                />
                <KeyMetric label="최고" value={`$${priceTarget.targetHigh.toFixed(2)}`} />
                <KeyMetric label="최저" value={`$${priceTarget.targetLow.toFixed(2)}`} />
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                업데이트: {new Date(priceTarget.lastUpdated).toLocaleDateString("ko-KR")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-muted/40">
            <CardContent className="py-4 text-xs text-muted-foreground">
              애널리스트 목표가 데이터가 없습니다 (Finnhub 커버리지 부재 또는 API 미연결).
            </CardContent>
          </Card>
        )}
        {recommendation && recommendation.length > 0 && (
          <Card className="mt-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">추천 등급 분포 (최근)</CardTitle>
              <CardDescription className="text-xs">{recommendation[0].period}</CardDescription>
            </CardHeader>
            <CardContent>
              <RecommendationBar row={recommendation[0]} />
            </CardContent>
          </Card>
        )}
      </section>

      {/* ═══ 4-5. Financial metrics + Fundamentals grid ═══ */}
      {fundamentals && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">펀더멘털</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <QuoteCell label="P/E" value={fundamentals.pe_ratio && fundamentals.pe_ratio > 0 ? fundamentals.pe_ratio.toFixed(2) : "-"} />
            <QuoteCell label="P/B" value={fundamentals.pb_ratio?.toFixed(2) ?? "-"} />
            <QuoteCell label="P/S" value={fundamentals.ps_ratio?.toFixed(2) ?? "-"} />
            <QuoteCell label="EPS" value={fundamentals.eps ? `$${fundamentals.eps.toFixed(2)}` : "-"} />
            <QuoteCell label="ROE" value={fundamentals.roe !== null ? `${(fundamentals.roe * 100).toFixed(1)}%` : "-"} />
            <QuoteCell label="배당%" value={fundamentals.dividend_yield && fundamentals.dividend_yield > 0 ? `${fundamentals.dividend_yield.toFixed(2)}%` : "-"} />
            <QuoteCell label="Beta" value={fundamentals.beta?.toFixed(2) ?? "-"} />
            <QuoteCell label="부채비율" value={fundamentals.debt_to_equity?.toFixed(1) ?? "-"} />
            <QuoteCell label="장부가치" value={fundamentals.book_value ? `$${fundamentals.book_value.toFixed(2)}` : "-"} />
            <QuoteCell label="주당매출" value={fundamentals.revenue_per_share ? `$${fundamentals.revenue_per_share.toFixed(2)}` : "-"} />
            <QuoteCell label="평균거래량" value={fundamentals.avg_volume ? `${(fundamentals.avg_volume / 1e6).toFixed(1)}M` : "-"} />
            <QuoteCell
              label="52W 고점 대비"
              value={highDist !== null ? `${highDist >= 0 ? "+" : ""}${highDist.toFixed(1)}%` : "-"}
              color={highDist !== null && highDist > -5 ? "text-success" : "text-muted-foreground"}
            />
          </CardContent>
        </Card>
      )}

      {/* ═══ 6. News (Finnhub) ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📰 최근 뉴스</CardTitle>
          <CardDescription className="text-xs">
            Finnhub 최근 14일 · {news?.length ?? 0}건
          </CardDescription>
        </CardHeader>
        <CardContent>
          {news && news.length > 0 ? (
            <div className="flex flex-col gap-2">
              {news.slice(0, 10).map((n, i) => (
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
            <p className="text-xs text-muted-foreground">최근 뉴스가 없거나 Finnhub API가 미연결 상태입니다.</p>
          )}
        </CardContent>
      </Card>

      {/* ═══ 7. Earnings Surprise (placeholder) ═══ */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">📊 실적 서프라이즈 히스토리 (준비 중)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Streamlit은 Estimate vs Reported 바차트 + Beat/Miss 비율 + 평균 서프라이즈% + 마지막 분기 서프라이즈% 메트릭을 표시.
          Finnhub earnings API 프록시 필요.
        </CardContent>
      </Card>

      {/* ═══ 8. Insider Trading (placeholder) ═══ */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-base">🏛️ 내부자 거래 (SEC Form 4) (준비 중)</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Streamlit은 SEC EDGAR Form 4 데이터로 임원명·관계·거래유형·주수·가격·금액·신고일 테이블을 표시.
          이 데이터는 <Link href="/sec-intelligence" className="text-primary hover:underline">SEC Intelligence</Link>{" "}
          페이지에서 13F 홀딩과 함께 확인 가능 (내부자는 Form 4 파싱 스크립트 추가 후 활성화).
        </CardContent>
      </Card>

      {/* ═══ 9. AI Earnings Summary (placeholder) ═══ */}
      <Card className="border-premium/30 bg-premium/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">🤖 AI 실적 요약</CardTitle>
            <Badge variant="secondary" className="bg-premium/20 text-premium text-[10px]">LLM</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Streamlit은 Gemini 2.5 Flash로 실적품질 · 강점 · 우려 · 컨센서스 · 평가 5섹션 리포트를 생성.
          LLM API 프록시 (Anthropic/Google) 도입 후 활성화.
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">비고:</strong> TradingView 차트 · 애널리스트 컨센서스 · 뉴스는 실데이터.
        AI 밸류에이션 · 실적 서프라이즈 상세 · SEC Form 4 내부자 거래는 LLM/SEC Form 4 파이프라인 도입 후 활성화 예정.
      </div>
    </div>
  );
}

// ─────────────── Sub-components ───────────────

function KeyMetric({
  label,
  value,
  change,
}: { label: string; value: string; change?: number }) {
  const isUp = (change ?? 0) >= 0;
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {change !== undefined && (
        <div className={cn("mt-0.5 flex items-center gap-1 text-xs font-semibold tabular-nums", isUp ? "text-success" : "text-destructive")}>
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isUp ? "+" : ""}{change.toFixed(2)}%
        </div>
      )}
    </div>
  );
}

function QuoteCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", color ?? "text-foreground")}>{value}</div>
    </div>
  );
}

function RecommendationBar({ row }: { row: import("@/lib/finnhub").RecommendationRow }) {
  const total = row.strongBuy + row.buy + row.hold + row.sell + row.strongSell;
  if (total === 0) return <p className="text-xs text-muted-foreground">-</p>;
  const segments = [
    { label: "강력매수", n: row.strongBuy, color: "bg-success" },
    { label: "매수", n: row.buy, color: "bg-success/60" },
    { label: "보유", n: row.hold, color: "bg-muted-foreground/40" },
    { label: "매도", n: row.sell, color: "bg-destructive/60" },
    { label: "강력매도", n: row.strongSell, color: "bg-destructive" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-6 w-full overflow-hidden rounded-full">
        {segments.map(
          (s) => s.n > 0 && (
            <div
              key={s.label}
              className={cn("relative", s.color)}
              style={{ width: `${(s.n / total) * 100}%` }}
              title={`${s.label}: ${s.n}`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-background">
                {s.n}
              </span>
            </div>
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", s.color)} />
            {s.label} ({s.n})
          </span>
        ))}
        <span className="ml-auto font-semibold text-foreground">총 {total}명</span>
      </div>
    </div>
  );
}

