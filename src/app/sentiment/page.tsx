import { getMarketSnapshot } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = { title: "센티먼트 · AI Quant Lab" };

/** VIX-based sentiment scale: VIX low → greed, VIX high → fear. */
function vixToSentiment(vix: number): { label: string; score: number; color: string } {
  // 0-100 scale; VIX 12 = 90, VIX 30 = 10 (empirical mapping)
  const score = Math.max(0, Math.min(100, 100 - ((vix - 12) / 18) * 80));
  let label: string;
  let color: string;
  if (score >= 75) {
    label = "Extreme Greed";
    color = "text-success";
  } else if (score >= 55) {
    label = "Greed";
    color = "text-success/80";
  } else if (score >= 45) {
    label = "Neutral";
    color = "text-muted-foreground";
  } else if (score >= 25) {
    label = "Fear";
    color = "text-amber-400";
  } else {
    label = "Extreme Fear";
    color = "text-destructive";
  }
  return { label, score: Math.round(score), color };
}

export default async function SentimentPage() {
  const s = await getMarketSnapshot();
  const sentiment = vixToSentiment(s.vix.current);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">센티먼트</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">공포 &amp; 탐욕 지수와 변동성 지표</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Fear &amp; Greed (VIX 기반)</CardTitle>
          <CardDescription>VIX 지수로 도출한 시장 심리 (0=극단적 공포, 100=극단적 탐욕)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <div className="text-center">
            <div className={cn("text-6xl font-bold tabular-nums", sentiment.color)}>
              {sentiment.score}
            </div>
            <div className={cn("mt-1 text-lg font-semibold", sentiment.color)}>{sentiment.label}</div>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">VIX 통계 (최근 6개월)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground">현재</div>
                <div className="font-semibold tabular-nums">{s.vix.current.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">평균</div>
                <div className="font-semibold tabular-nums">{s.vix.avg.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">최저</div>
                <div className="font-semibold tabular-nums text-success">{s.vix.min.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">최고</div>
                <div className="font-semibold tabular-nums text-destructive">{s.vix.max.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              추세: <span className="font-semibold text-foreground">{s.vix.trend}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">해석 가이드</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <ul className="flex flex-col gap-1.5">
              <li>
                <strong className="text-success">VIX &lt; 15</strong>: 탐욕 구간 — 시장 낙관, 조정 리스크
              </li>
              <li>
                <strong className="text-muted-foreground">VIX 15~20</strong>: 중립 — 정상 변동성 범위
              </li>
              <li>
                <strong className="text-amber-400">VIX 20~30</strong>: 공포 진입 — 방어적 접근 고려
              </li>
              <li>
                <strong className="text-destructive">VIX &gt; 30</strong>: 극단적 공포 — 역발상 매수 기회
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        상세 뉴스 감정 분석·워드클라우드는 다음 단계에서 추가됩니다.
      </p>
    </div>
  );
}
