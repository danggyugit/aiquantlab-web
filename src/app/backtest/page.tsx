import { Sparkles } from "lucide-react";
import {
  BACKTEST_PRESET_IDS,
  getAllBacktestPresetsSummary,
  getBacktestPreset,
  getStocksMeta,
} from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lab } from "../ai-quant-lab/lab";
import { FactorLabClient } from "../factor-lab/factor-lab-client";

export const metadata = { title: "백테스트 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Unified backtest workbench — 2 tabs:
 *   1. 룰 기반 (Factor Lab): real-time execution via FastAPI /factor-backtest
 *      (20+ pure rank_fn strategies, 5-15s per run on Render Free)
 *   2. AI 프리셋 (AI Quant Lab): ML ensemble presets — full pipeline exceeds
 *      Render Free's 10-min HTTP timeout so we serve precomputed presets only
 */
export default async function BacktestPage() {
  // Loader UI only needs metadata — never the multi-MB `full` history payload.
  // We pull one preset's full data for the initial display so users see a
  // populated result on first paint; every other preset lazy-loads its full
  // JSON client-side when the user picks it (see Lab.handleLoadPreset).
  // Without this split the ISR page hits Vercel's 19 MB FALLBACK cap.
  const initialId = BACKTEST_PRESET_IDS[0];
  const [summaries, firstFull, stocks] = await Promise.all([
    getAllBacktestPresetsSummary(),
    getBacktestPreset(initialId).catch(() => null),
    getStocksMeta(),
  ]);
  const presets = firstFull
    ? summaries.map((p) => (p.preset_id === firstFull.preset_id ? firstFull : p))
    : summaries;
  const sectors = Array.from(new Set(stocks.map((s) => s.sector))).filter(Boolean).sort();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

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
              <h1 className="aiql-gradient-text text-2xl font-bold tracking-tight sm:text-3xl">백테스트</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                룰 기반 실행 · AI 앙상블 프리셋 · 20+ 팩터 전략
              </p>
            </div>
          </div>
          <MarketBadge />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="bg-premium/20 text-premium">PRO</Badge>
          <Badge variant="secondary">S&amp;P 1500 유니버스</Badge>
          <Badge variant="secondary">Point-in-Time 재무</Badge>
          <Badge variant="secondary">21-day embargo</Badge>
          <Badge variant="secondary">생존편향 보정</Badge>
        </div>
      </div>

      <Tabs defaultValue="rule">
        <TabsList className="flex flex-wrap gap-1 bg-transparent p-0">
          <TabsTrigger value="rule" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            🎯 룰 기반 (실시간 실행)
          </TabsTrigger>
          <TabsTrigger value="ml" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            🤖 AI 앙상블 (프리셋)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rule" className="mt-4">
          <FactorLabClient presets={presets} sectors={sectors} apiUrl={apiUrl} />
        </TabsContent>

        <TabsContent value="ml" className="mt-4">
          <Lab presets={presets} presetLoadedInitial={presets[0]} hideConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
