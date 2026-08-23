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
import {
  getCompanyNews,
  getDividendHistory,
  getEarningsSurprise,
  getEpsEstimate,
  getFinancials,
  getInsiderTransactions,
  getMetrics,
  getPriceTarget,
  getRecommendation,
} from "@/lib/finnhub";
import { AiEarningsSummary } from "./ai-summary";
import {
  AdvancedValuationCard,
  FinancialsTrendCard,
  GrowthMarginsCard,
} from "./fundamentals-deep";
import { DividendHistoryCard, EpsRevisionCard } from "./dividend-eps";
import { PeerComparisonCard } from "./peer-compare";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const [
    heatmap, fund, stocks, news, priceTarget, recommendation, earnings, insiders,
    metric, financials, dividends, epsEstimates,
  ] = await Promise.all([
    getHeatmap(),
    getFundamentals(),
    getStocksMeta(),
    getCompanyNews(ticker, 14),
    getPriceTarget(ticker),
    getRecommendation(ticker),
    getEarningsSurprise(ticker),
    getInsiderTransactions(ticker, 180),
    getMetrics(ticker),
    getFinancials(ticker, "quarterly"),
    getDividendHistory(ticker, 10),
    getEpsEstimate(ticker, "quarterly"),
  ]);

  const meta = stocks.find((s) => s.ticker === ticker);
  const priceData = heatmap.tickers[ticker];
  const fundamentals = fund.tickers[ticker];

  if (!meta || !priceData) notFound();

  const quote = latestQuote(priceData);
  const highDist = fundamentals
    ? distanceFromHigh(quote?.price ?? 0, fundamentals.fifty_two_week_high)
    : null;

  // 52W range position (0-100%)
  const rangePct = fundamentals?.fifty_two_week_high && fundamentals.fifty_two_week_low && quote
    ? ((quote.price - fundamentals.fifty_two_week_low) /
        (fundamentals.fifty_two_week_high - fundamentals.fifty_two_week_low)) * 100
    : null;

  // AI summary context (LLM call runs client-side to sidestep Vercel Hobby's
  // 10s serverless timeout — Render Free cold start + Gemini generation can
  // exceed that window and kill SSR before the response returns).
  const aiContext = earnings && earnings.length > 0
    ? {
        symbol: ticker,
        name: meta.name,
        price: quote?.price ?? null,
        market_cap: priceData.market_cap ?? null,
        pe: fundamentals?.pe_ratio ?? null,
        sector: meta.sector,
        analyst_target_mean: priceTarget?.targetMean ?? null,
        // Latest month's recommendation distribution — Gemini reads this to
        // give a real "N명 중 X명 매수 우세" verdict instead of falling back
        // to "데이터 부족" when price target is missing (Finnhub paid tier).
        analyst_recommendation: recommendation?.[0]
          ? {
              period: recommendation[0].period,
              strongBuy: recommendation[0].strongBuy,
              buy: recommendation[0].buy,
              hold: recommendation[0].hold,
              sell: recommendation[0].sell,
              strongSell: recommendation[0].strongSell,
            }
          : null,
        earnings_history: earnings.slice(0, 4).map((e) => ({
          period: e.period,
          actual: e.actual,
          estimate: e.estimate,
          surprisePercent: e.surprisePercent,
        })),
      }
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

      {/* ═══ 1. Quick Stats · 5 핵심 수치 + 52W range ═══ */}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <KeyMetric label="현재가" value={quote ? `$${quote.price.toFixed(2)}` : "-"} change={quote?.changePct} />
            <KeyMetric label="시가총액" value={priceData.market_cap ? fmtMarketCap(priceData.market_cap) : "-"} />
            <KeyMetric label="P/E" value={fundamentals?.pe_ratio && fundamentals.pe_ratio > 0 ? fundamentals.pe_ratio.toFixed(1) : "-"} />
            <KeyMetric label="52주 고가" value={fundamentals?.fifty_two_week_high ? `$${fundamentals.fifty_two_week_high.toFixed(2)}` : "-"} />
            <KeyMetric label="52주 저가" value={fundamentals?.fifty_two_week_low ? `$${fundamentals.fifty_two_week_low.toFixed(2)}` : "-"} />
          </div>
          {rangePct !== null && fundamentals?.fifty_two_week_low && fundamentals?.fifty_two_week_high && (
            <div>
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
        </CardContent>
      </Card>

      {/* ═══ 2. AI 실적 요약 — 상단 배치 (TL;DR) ═══ */}
      <Card className="border-premium/30 bg-premium/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">🤖 AI 실적 요약</CardTitle>
            <Badge variant="secondary" className="bg-premium/20 text-premium text-[10px]">Gemini 2.5 Flash</Badge>
          </div>
          <CardDescription className="text-xs">
            30초 요약 · 실적품질 · 강점 · 우려 · 애널리스트 컨센서스 · 종합판정 5섹션
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aiContext ? (
            <AiEarningsSummary {...aiContext} />
          ) : (
            <p className="text-xs text-muted-foreground">실적 데이터가 없어 요약을 생성할 수 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* ═══ 3. TradingView Chart ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📈 가격 차트</CardTitle>
          <CardDescription className="text-xs">TradingView · 인디케이터 · 드로잉 · 여러 봉 지원</CardDescription>
        </CardHeader>
        <CardContent>
          <TradingViewWidget symbol={ticker} />
        </CardContent>
      </Card>

      {/* ═══ 4. Analyst View (목표가 + 추천등급 통합) ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">👔 애널리스트 컨센서스</CardTitle>
          <CardDescription className="text-xs">
            {priceTarget ? "목표가 · 추천 등급 분포" : "추천 등급 분포 (목표가는 유료 tier)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {priceTarget ? (
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
          ) : (
            <p className="text-xs text-muted-foreground">
              목표가 컨센서스는 Finnhub <strong>유료 tier</strong> 데이터 (무료 접근 불가). 아래 추천 등급 분포는 무료 tier로도 확인 가능.
            </p>
          )}
          {recommendation && recommendation.length > 0 && (
            <div className="border-t border-border/40 pt-4">
              <div className="mb-2 flex items-baseline justify-between text-xs">
                <span className="font-semibold">추천 등급 분포</span>
                <span className="text-muted-foreground">{recommendation[0].period}</span>
              </div>
              <RecommendationBar row={recommendation[0]} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 5. Earnings Surprise ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 실적 서프라이즈</CardTitle>
          <CardDescription className="text-xs">
            {earnings ? `최근 ${earnings.length}분기 · Actual vs Estimate` : "Finnhub"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EarningsSurpriseView data={earnings} />
        </CardContent>
      </Card>

      {/* ═══ 6. Insider Trading (SEC Form 4) ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">🏛️ 내부자 거래 (SEC Form 4)</CardTitle>
          <CardDescription className="text-xs">
            {insiders ? `최근 6개월 · ${insiders.length}건` : "최근 6개월"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InsiderView data={insiders} />
        </CardContent>
      </Card>

      {/* ═══ 7. News ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📰 최근 뉴스</CardTitle>
          <CardDescription className="text-xs">Finnhub 최근 14일 · {news?.length ?? 0}건</CardDescription>
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

      {/* ═══ 8. 성장률 & 마진 스냅샷 (Tier 1 #2 · #3) ═══ */}
      <GrowthMarginsCard metric={metric} />

      {/* ═══ 9. 재무제표 추세 (Tier 1 #1) — 최근 4-8분기 매출·순이익·FCF ═══ */}
      <FinancialsTrendCard filings={financials} />

      {/* ═══ 10. 애널리스트 EPS 추정 (Tier 2 #10) ═══ */}
      <EpsRevisionCard estimates={epsEstimates} actuals={earnings} />

      {/* ═══ 11. 배당 이력 (Tier 1 #4) — 10년 지속성 판단 ═══ */}
      {dividends && dividends.length > 0 && <DividendHistoryCard data={dividends} />}

      {/* ═══ 12. 고급 밸류에이션 (Tier 2 #14) — PEG · EV/EBITDA · P/FCF ═══ */}
      {metric && <AdvancedValuationCard metric={metric} />}

      {/* ═══ 13. 경쟁사 비교 (Tier 1 #5) — 동종 산업 상위 5개 ═══ */}
      <PeerComparisonCard
        ticker={ticker}
        meta={meta}
        stocks={stocks}
        heatmapTickers={heatmap.tickers}
        fundamentalsTickers={fund.tickers}
        n={5}
      />

      {/* ═══ 13. 펀더멘털 상세 (접이식 · 관심자만) ═══ */}
      {fundamentals && (
        <details className="rounded-lg border border-border/40 bg-card/40 p-4">
          <summary className="cursor-pointer text-sm font-semibold hover:text-primary">
            🔬 펀더멘털 상세 (12개 지표)
          </summary>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          </div>
        </details>
      )}
    </div>
  );
}

// ─────────────── Sub-components ───────────────

function KeyMetric({
  label,
  value,
  change,
  tone,
}: {
  label: string;
  value: string;
  change?: number;
  /** Override the auto-colouring (usually driven by `change`) — useful when
   * `value` is a formatted string like "+$1.2B" that already carries sign. */
  tone?: "up" | "down" | "neutral";
}) {
  const isUp = (change ?? 0) >= 0;
  const valueColor = tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-bold tabular-nums", valueColor)}>{value}</div>
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

// ─────────── Section renderers (earnings / insider / AI) ───────────

function EarningsSurpriseView({ data }: { data: import("@/lib/finnhub").EarningsSurpriseRow[] | null }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        실적 데이터가 없거나 Finnhub API가 미연결 상태입니다.
      </p>
    );
  }
  // Sort chronological (oldest first) for the mini bar chart
  const chrono = [...data].sort((a, b) => a.period.localeCompare(b.period));
  const beats = data.filter((d) => d.surprisePercent > 0).length;
  const beatRate = (beats / data.length) * 100;
  const avgSurprise = data.reduce((s, d) => s + d.surprisePercent, 0) / data.length;
  const latest = chrono[chrono.length - 1];

  // Consecutive beat/miss streak from the most recent quarter backwards
  let streak = 0;
  let streakKind: "beat" | "miss" | null = null;
  for (let i = chrono.length - 1; i >= 0; i--) {
    const isBeat = chrono[i].surprisePercent > 0;
    if (streakKind === null) {
      streakKind = isBeat ? "beat" : "miss";
      streak = 1;
    } else if ((streakKind === "beat" && isBeat) || (streakKind === "miss" && !isBeat)) {
      streak += 1;
    } else {
      break;
    }
  }

  // Bar chart bounds
  const maxAbs = Math.max(...chrono.flatMap((d) => [Math.abs(d.actual), Math.abs(d.estimate)]));

  return (
    <div className="flex flex-col gap-4">
      {/* Streak badge — instant visual verdict */}
      {streakKind && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
            streakKind === "beat"
              ? "border-success/40 bg-success/10 text-success"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          <span className="text-lg">{streakKind === "beat" ? "🔥" : "❄️"}</span>
          <span>
            {streak}분기 연속 {streakKind === "beat" ? "컨센서스 상회 (Beat)" : "컨센서스 하회 (Miss)"}
          </span>
        </div>
      )}

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <KeyMetric
          label="Beat 비율"
          value={`${beatRate.toFixed(0)}%`}
          change={beatRate - 50}
        />
        <KeyMetric
          label="평균 서프라이즈"
          value={`${avgSurprise >= 0 ? "+" : ""}${avgSurprise.toFixed(2)}%`}
          change={avgSurprise}
        />
        <KeyMetric
          label={`최근 분기 (${latest.period.slice(0, 7)})`}
          value={`${latest.surprisePercent >= 0 ? "+" : ""}${latest.surprisePercent.toFixed(2)}%`}
          change={latest.surprisePercent}
        />
      </div>

      {/* Bar chart per quarter */}
      <div className="flex flex-col gap-2">
        {chrono.map((d) => {
          const actualPct = (Math.abs(d.actual) / maxAbs) * 100;
          const estimatePct = (Math.abs(d.estimate) / maxAbs) * 100;
          const beat = d.surprisePercent > 0;
          return (
            <div key={d.period} className="grid grid-cols-[80px_1fr_100px] items-center gap-3 text-xs">
              <span className="font-mono text-muted-foreground">
                {d.year} Q{d.quarter}
              </span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <div
                    className={cn("h-3 rounded-sm", beat ? "bg-success/80" : "bg-destructive/80")}
                    style={{ width: `${actualPct}%` }}
                    title={`Actual EPS: $${d.actual}`}
                  />
                  <span className="tabular-nums text-[10px] text-muted-foreground">Actual ${d.actual}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 rounded-sm bg-muted-foreground/40"
                    style={{ width: `${estimatePct}%` }}
                    title={`Estimate EPS: $${d.estimate}`}
                  />
                  <span className="tabular-nums text-[10px] text-muted-foreground">Est. ${d.estimate}</span>
                </div>
              </div>
              <span
                className={cn(
                  "text-right tabular-nums font-semibold",
                  beat ? "text-success" : "text-destructive",
                )}
              >
                {d.surprisePercent >= 0 ? "+" : ""}{d.surprisePercent.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsiderView({ data }: { data: import("@/lib/finnhub").InsiderTx[] | null }) {
  if (!data || data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        최근 6개월 내부자 거래가 없거나 Finnhub API가 미연결 상태입니다.
      </p>
    );
  }
  // Sort by filing date desc, show top 20
  const rows = [...data]
    .sort((a, b) => (b.filingDate || "").localeCompare(a.filingDate || ""))
    .slice(0, 20);

  // Summary: buy vs sell counts + net shares
  const buys = data.filter((d) => d.change > 0);
  const sells = data.filter((d) => d.change < 0);
  const netUsd = data.reduce((s, d) => s + (d.change * (d.transactionPrice || 0)), 0);

  // Group by month to show a mini sparkline of net USD activity
  const byMonth = new Map<string, number>();
  for (const t of data) {
    const m = (t.filingDate || "").slice(0, 7);
    if (!m) continue;
    byMonth.set(m, (byMonth.get(m) ?? 0) + t.change * (t.transactionPrice || 0));
  }
  const monthly = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, netUsd]) => ({ month, netUsd }));
  const monthlyMaxAbs = Math.max(1, ...monthly.map((m) => Math.abs(m.netUsd)));

  return (
    <div className="flex flex-col gap-3">
      {/* Big verdict badge */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
          netUsd >= 0
            ? "border-success/40 bg-success/10 text-success"
            : "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        <span className="text-lg">{netUsd >= 0 ? "🟢" : "🔴"}</span>
        <span>
          최근 6개월 내부자 {netUsd >= 0 ? "순매수" : "순매도"} · {fmtSignedUsd(netUsd)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KeyMetric label="매수 건수" value={String(buys.length)} tone={buys.length > sells.length ? "up" : "neutral"} />
        <KeyMetric label="매도 건수" value={String(sells.length)} tone={sells.length > buys.length ? "down" : "neutral"} />
        <KeyMetric
          label="순 매수 (USD)"
          value={fmtSignedUsd(netUsd)}
          tone={netUsd >= 0 ? "up" : "down"}
        />
      </div>

      {/* Monthly net-buy sparkline (bar per month, +/- around zero) */}
      {monthly.length > 1 && (
        <div className="rounded-md border border-border/40 bg-card/40 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            월별 순매수 흐름
          </div>
          <div className="flex items-end gap-1" style={{ height: 60 }}>
            {monthly.map((m) => {
              const pctHeight = (Math.abs(m.netUsd) / monthlyMaxAbs) * 100;
              const isUp = m.netUsd >= 0;
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1" title={`${m.month}: ${fmtSignedUsd(m.netUsd)}`}>
                  <div className="flex w-full flex-col justify-end" style={{ height: 44 }}>
                    <div
                      className={cn("w-full rounded-sm", isUp ? "bg-success/70" : "bg-destructive/70")}
                      style={{ height: `${pctHeight}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-border/60 bg-muted/20 text-left text-[10px] text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5">신고일</th>
              <th className="px-2 py-1.5">이름</th>
              <th className="px-2 py-1.5 hidden md:table-cell">직위</th>
              <th className="px-2 py-1.5 text-center">구분</th>
              <th className="px-2 py-1.5 text-right">주 수</th>
              <th className="px-2 py-1.5 text-right hidden sm:table-cell">가격</th>
              <th className="px-2 py-1.5 text-right">금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx, i) => {
              const isBuy = tx.change > 0;
              const usd = tx.change * (tx.transactionPrice || 0);
              return (
                <tr key={i} className="border-b border-border/30">
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{tx.filingDate?.slice(5) ?? "-"}</td>
                  <td className="px-2 py-1.5 truncate max-w-[160px]">{tx.name}</td>
                  <td className="px-2 py-1.5 hidden md:table-cell text-muted-foreground truncate max-w-[140px]">{tx.position ?? "-"}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      isBuy ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    )}>
                      {tx.transactionCode} {isBuy ? "매수" : "매도"}
                    </span>
                  </td>
                  <td className={cn("px-2 py-1.5 text-right tabular-nums", isBuy ? "text-success" : "text-destructive")}>
                    {isBuy ? "+" : ""}{tx.change.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums hidden sm:table-cell text-muted-foreground">
                    ${tx.transactionPrice?.toFixed(2) ?? "-"}
                  </td>
                  <td className={cn("px-2 py-1.5 text-right tabular-nums font-semibold", isBuy ? "text-success" : "text-destructive")}>
                    {fmtSignedUsd(usd)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data.length > 20 && (
        <p className="text-[10px] text-muted-foreground text-center">
          최근 20건 표시 · 전체 {data.length}건
        </p>
      )}
    </div>
  );
}

function fmtSignedUsd(v: number): string {
  const sign = v >= 0 ? "+" : "-";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${sign === "+" ? "" : "-"}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
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

