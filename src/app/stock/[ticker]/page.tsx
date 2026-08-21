import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getHeatmap, getFundamentals, getStocksMeta, latestQuote, distanceFromHigh, fmtMarketCap } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "./price-chart";
import { cn } from "@/lib/utils";

export const revalidate = 900;

type PageProps = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { ticker } = await params;
  const upper = ticker.toUpperCase();
  return { title: `${upper} · AI Quant Lab` };
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();

  const [heatmap, fund, stocks] = await Promise.all([
    getHeatmap(),
    getFundamentals(),
    getStocksMeta(),
  ]);

  const meta = stocks.find((s) => s.ticker === ticker);
  const priceData = heatmap.tickers[ticker];
  const fundamentals = fund.tickers[ticker];

  if (!meta || !priceData) {
    notFound();
  }

  const quote = latestQuote(priceData);
  const highDist = fundamentals ? distanceFromHigh(quote?.price ?? 0, fundamentals.fifty_two_week_high) : null;

  const chartData = priceData.prices.map((p) => ({
    date: p.date.slice(5),
    close: p.close,
    high: p.high,
    low: p.low,
    volume: p.volume,
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <Link
          href="/stock"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> 목록으로
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
        </header>
      </div>

      {/* Quote card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">현재가 (최근 종가)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <QuoteCell label="종가" value={quote ? `$${quote.price.toFixed(2)}` : "-"} />
          <QuoteCell
            label="전일대비"
            value={quote ? `${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%` : "-"}
            color={(quote?.changePct ?? 0) >= 0 ? "text-success" : "text-destructive"}
          />
          <QuoteCell
            label="시가총액"
            value={priceData.market_cap ? fmtMarketCap(priceData.market_cap) : "-"}
          />
          <QuoteCell
            label="52주 고점 대비"
            value={highDist !== null ? `${highDist.toFixed(1)}%` : "-"}
            color={highDist !== null && highDist > -5 ? "text-success" : "text-muted-foreground"}
          />
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">가격 차트</CardTitle>
          <CardDescription className="text-xs">
            {chartData.length}일치 종가 (현재 캐시는 최근 5거래일)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PriceChart data={chartData} />
        </CardContent>
      </Card>

      {/* Fundamentals */}
      {fundamentals && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">펀더멘털</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <QuoteCell label="PER" value={fundamentals.pe_ratio !== null && fundamentals.pe_ratio > 0 ? fundamentals.pe_ratio.toFixed(2) : "-"} />
            <QuoteCell label="PBR" value={fundamentals.pb_ratio !== null ? fundamentals.pb_ratio.toFixed(2) : "-"} />
            <QuoteCell label="PSR" value={fundamentals.ps_ratio !== null ? fundamentals.ps_ratio.toFixed(2) : "-"} />
            <QuoteCell label="EPS" value={fundamentals.eps !== null ? `$${fundamentals.eps.toFixed(2)}` : "-"} />
            <QuoteCell label="ROE" value={fundamentals.roe !== null ? `${(fundamentals.roe * 100).toFixed(1)}%` : "-"} />
            <QuoteCell label="배당수익률" value={fundamentals.dividend_yield !== null && fundamentals.dividend_yield > 0 ? `${fundamentals.dividend_yield.toFixed(2)}%` : "-"} />
            <QuoteCell label="Beta" value={fundamentals.beta !== null ? fundamentals.beta.toFixed(2) : "-"} />
            <QuoteCell label="부채비율" value={fundamentals.debt_to_equity !== null ? fundamentals.debt_to_equity.toFixed(1) : "-"} />
            <QuoteCell label="52주 고점" value={fundamentals.fifty_two_week_high !== null ? `$${fundamentals.fifty_two_week_high.toFixed(2)}` : "-"} />
            <QuoteCell label="52주 저점" value={fundamentals.fifty_two_week_low !== null ? `$${fundamentals.fifty_two_week_low.toFixed(2)}` : "-"} />
            <QuoteCell label="장부가치" value={fundamentals.book_value !== null ? `$${fundamentals.book_value.toFixed(2)}` : "-"} />
            <QuoteCell label="주당매출" value={fundamentals.revenue_per_share !== null ? `$${fundamentals.revenue_per_share.toFixed(2)}` : "-"} />
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">데이터 한계:</strong> 현재 가격 캐시는 최근 5거래일만 저장되어 장기 차트는 제한적입니다.
        재무제표 시계열·뉴스·인사이더 거래는 별도 캐시 확장이 필요합니다.
      </div>
    </div>
  );
}

function QuoteCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", color ?? "text-foreground")}>
        {value}
      </div>
    </div>
  );
}
