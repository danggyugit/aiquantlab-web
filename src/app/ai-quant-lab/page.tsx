import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { getHeatmap, getFundamentals, getStocksMeta, getAllBacktestPresets } from "@/lib/data";
import type { BacktestUniverseItem } from "@/lib/backtest";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BacktestLab } from "./backtest-lab";

export const metadata = { title: "AI Quant Lab · 백테스트 워크벤치" };
export const revalidate = 900;

export default async function AiQuantLabPage() {
  const [heatmap, fund, stocks, presets] = await Promise.all([
    getHeatmap(),
    getFundamentals(),
    getStocksMeta(),
    getAllBacktestPresets(),
  ]);

  const stockMap = new Map(stocks.map((s) => [s.ticker, s]));

  // Build the backtest universe by joining prices + fundamentals + meta.
  const universe: BacktestUniverseItem[] = [];
  for (const [ticker, data] of Object.entries(heatmap.tickers)) {
    const meta = stockMap.get(ticker);
    const f = fund.tickers[ticker];
    if (!meta || !data.prices?.length) continue;
    universe.push({
      ticker,
      name: data.name,
      sector: data.sector || meta.sector,
      capTier: meta.cap_tier,
      marketCap: data.market_cap,
      prices: data.prices.map((p) => ({ date: p.date, close: p.close })),
      pe: f?.pe_ratio ?? null,
      pb: f?.pb_ratio ?? null,
      roe: f?.roe ?? null,
      div: f?.dividend_yield ?? null,
      beta: f?.beta ?? null,
    });
  }

  const sectors = Array.from(new Set(universe.map((u) => u.sector))).filter(Boolean).sort();
  const bestPreset = [...presets].sort((a, b) => (b.summary.cagr_pct ?? 0) - (a.summary.cagr_pct ?? 0))[0];

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
              <p className="mt-1 text-sm text-muted-foreground">
                팩터 기반 인터랙티브 백테스트 · 유니버스 {universe.length.toLocaleString()}개 종목
              </p>
            </div>
          </div>
          <MarketBadge />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-premium/20 text-premium">PRO</Badge>
          <Badge variant="secondary">브라우저 실시간 연산</Badge>
          <Badge variant="secondary">S&amp;P500 유니버스</Badge>
        </div>
      </div>

      {/* Interactive backtest */}
      <BacktestLab universe={universe} sectors={sectors} />

      {/* Reference precomputed presets */}
      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">
              장기 백테스트 프리셋도 확인해보세요
            </div>
            <div className="text-xs text-muted-foreground">
              Python 백테스트 엔진 기반 {presets.length}개 프리셋 · 최고 CAGR{" "}
              <span className="text-success font-semibold">{bestPreset.summary.cagr_pct?.toFixed(1)}%</span>{" "}
              ({bestPreset.name})
            </div>
          </div>
          <Link
            href="/factor-lab"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Factor Lab 열기 <ArrowRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
