import { getAllBacktestPresets, getStocksMeta } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Badge } from "@/components/ui/badge";
import { FactorLabClient } from "./factor-lab-client";

export const metadata = { title: "Factor Lab · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 12_Factor_Lab.py — 3 tabs:
 *   1. 단일 전략 (Single Strategy): strategy selectbox + config form + result
 *   2. 전략 비교 (Compare Strategies): multi-select up to 5 + shared config + comparison
 *   3. 전략 설명 (Strategy Guide): 20+ 전략 카테고리별 설명
 *
 * Real Factor Lab backtest execution requires Python (PIT financial joins,
 * monthly rebalance loop with 20+ scoring functions). Not runnable in
 * browser. Run button loads AI Quant Lab's closest preset + banner note.
 */
export default async function FactorLabPage() {
  const [presets, stocks] = await Promise.all([getAllBacktestPresets(), getStocksMeta()]);
  const sectors = Array.from(new Set(stocks.map((s) => s.sector))).filter(Boolean).sort();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.10] via-transparent to-transparent p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Factor Lab</h1>
          <MarketBadge />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          룰 기반 팩터 백테스터 · 20+ 전략 · Streamlit 12_Factor_Lab.py 미러링
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">PIT-safe</Badge>
          <Badge variant="secondary" className="text-[10px]">21-day embargo</Badge>
          <Badge variant="secondary" className="text-[10px]">생존편향 보정</Badge>
          <Badge variant="secondary" className="text-[10px]">20+ Strategies</Badge>
        </div>
      </div>

      <FactorLabClient presets={presets} sectors={sectors} />
    </div>
  );
}
