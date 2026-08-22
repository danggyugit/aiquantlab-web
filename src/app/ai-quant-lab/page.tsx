import { Sparkles } from "lucide-react";
import { getAllBacktestPresets } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Badge } from "@/components/ui/badge";
import { Lab } from "./lab";

export const metadata = { title: "AI Quant Lab · 백테스트 워크벤치" };
export const revalidate = 900;

export default async function AiQuantLabPage() {
  const presets = await getAllBacktestPresets();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      {/* Hero — matches Streamlit's title + tag badges */}
      <div className="rounded-2xl border border-premium/40 bg-gradient-to-br from-premium/[0.15] via-primary/[0.10] to-transparent p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-premium/20 p-2.5">
              <Sparkles className="h-6 w-6 text-premium" />
            </div>
            <div>
              <h1 className="aiql-gradient-text text-2xl font-bold tracking-tight sm:text-3xl">AI Quant Lab</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                AI 퀀트 백테스팅 &amp; 실시간 종목 추천
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
          <Badge variant="secondary">Ensemble ML</Badge>
          <Badge variant="secondary">레짐 감지</Badge>
        </div>
      </div>

      <Lab
        presets={presets}
        presetLoadedInitial={presets[0]}
        // AI Quant Lab's full ML pipeline (Ensemble + regime) exceeds the
        // 10-min Render Free HTTP timeout. Factor Lab uses the API instead;
        // this page stays on preset matching.
      />
    </div>
  );
}
