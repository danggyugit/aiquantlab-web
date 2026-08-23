import { getMarketSnapshot } from "@/lib/data";
import { getMarketNews } from "@/lib/finnhub";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectorStrip } from "@/components/sector-strip";
import { VixChart } from "@/app/macro/vix-chart";
import { cn } from "@/lib/utils";

export const metadata = { title: "센티먼트 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Sentiment page — narrative-first layout.
 * Reads top-to-bottom as: 오늘의 판정 (30초) → 게이지 → 폭·변동성 → 섹터 회전 → 뉴스.
 * Each card explains WHY it matters and HOW to interpret today's reading.
 */

// ── Sentiment scoring helpers ────────────────────────────────────

function vixToScore(vix: number): number {
  // 12 → 100 (extreme greed), 30 → 20 (extreme fear); clamp.
  return Math.max(0, Math.min(100, 100 - ((vix - 12) / 18) * 80));
}

function scoreLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: "Extreme Greed", color: "text-success", bg: "bg-success/10" };
  if (score >= 55) return { label: "Greed",          color: "text-success/80", bg: "bg-success/5" };
  if (score >= 45) return { label: "Neutral",        color: "text-muted-foreground", bg: "bg-muted/20" };
  if (score >= 25) return { label: "Fear",           color: "text-amber-400", bg: "bg-amber-500/10" };
  return                  { label: "Extreme Fear",   color: "text-destructive", bg: "bg-destructive/10" };
}

// Risk-On / Risk-Off score from sector 1M returns.
// Cyclical (경기순환) minus defensive (방어) — positive = risk-on appetite.
const CYCLICAL_ETFS = new Set(["XLY", "XLK", "XLC", "XLF", "XLI"]);
const DEFENSIVE_ETFS = new Set(["XLP", "XLU", "XLV", "XLRE"]);

function computeRiskOnOff(sectors: { ticker: string; ret_1m_pct: number }[]): {
  score: number;   // -10 ~ +10 (roughly)
  label: string;
  tone: "risk-on" | "risk-off" | "mixed";
  cyclicalAvg: number;
  defensiveAvg: number;
} {
  const cyc = sectors.filter((s) => CYCLICAL_ETFS.has(s.ticker));
  const def = sectors.filter((s) => DEFENSIVE_ETFS.has(s.ticker));
  const cycAvg = cyc.length ? cyc.reduce((s, x) => s + x.ret_1m_pct, 0) / cyc.length : 0;
  const defAvg = def.length ? def.reduce((s, x) => s + x.ret_1m_pct, 0) / def.length : 0;
  const diff = cycAvg - defAvg;
  const tone = diff > 1 ? "risk-on" : diff < -1 ? "risk-off" : "mixed";
  const label = tone === "risk-on" ? "Risk-On" : tone === "risk-off" ? "Risk-Off" : "Mixed";
  return { score: diff, label, tone, cyclicalAvg: cycAvg, defensiveAvg: defAvg };
}

// Overall verdict: combines fear-greed, breadth, risk-on/off.
function computeVerdict(fg: number, breadth: number, riskOnOff: number): {
  label: string;
  tone: "bull-strong" | "bull-mild" | "neutral" | "bear-mild" | "bear-strong";
  color: string;
  bullets: string[];
} {
  // Composite 0-100.
  const composite = 0.4 * fg + 0.4 * breadth + 0.2 * Math.max(0, Math.min(100, 50 + riskOnOff * 5));

  let tone: "bull-strong" | "bull-mild" | "neutral" | "bear-mild" | "bear-strong";
  let label: string;
  let color: string;
  if (composite >= 70)      { tone = "bull-strong"; label = "강세 (Risk-On)";       color = "text-success"; }
  else if (composite >= 55) { tone = "bull-mild";   label = "완만한 강세";           color = "text-success/80"; }
  else if (composite >= 45) { tone = "neutral";     label = "중립 (관망)";           color = "text-muted-foreground"; }
  else if (composite >= 30) { tone = "bear-mild";   label = "완만한 약세";           color = "text-amber-400"; }
  else                      { tone = "bear-strong"; label = "약세 (Risk-Off)";      color = "text-destructive"; }

  const bullets: string[] = [];

  // Fear & Greed
  if (fg >= 75) bullets.push(`공포·탐욕 ${Math.round(fg)} — 과열 · 조정 가능성 관찰`);
  else if (fg >= 55) bullets.push(`공포·탐욕 ${Math.round(fg)} — 상승 심리 우세`);
  else if (fg >= 45) bullets.push(`공포·탐욕 ${Math.round(fg)} — 방향성 없음`);
  else if (fg >= 25) bullets.push(`공포·탐욕 ${Math.round(fg)} — 심리 위축, 매수 기회 관찰`);
  else               bullets.push(`공포·탐욕 ${Math.round(fg)} — 극단적 공포 (역발상 매수 신호)`);

  // Breadth
  if (breadth >= 60) bullets.push(`시장 폭 ${Math.round(breadth)}% — 상승 참여 광범위 (건강한 랠리)`);
  else if (breadth >= 40) bullets.push(`시장 폭 ${Math.round(breadth)}% — 참여 제한 (선두 종목 중심)`);
  else                    bullets.push(`시장 폭 ${Math.round(breadth)}% — 대부분 종목 이평선 아래`);

  // Risk on/off
  if (riskOnOff > 2) bullets.push(`섹터 회전 = 순환주 강세 · 위험자산 선호`);
  else if (riskOnOff < -2) bullets.push(`섹터 회전 = 방어주 강세 · 위험자산 회피`);
  else bullets.push(`섹터 회전 = 혼조 · 뚜렷한 방향성 없음`);

  return { label, tone, color, bullets };
}

// ── Page ─────────────────────────────────────────────────────────

export default async function SentimentPage() {
  const [s, marketNews] = await Promise.all([
    getMarketSnapshot(),
    getMarketNews("general"),
  ]);

  // Prefer the backend-computed CNN-style Fear & Greed (VIX + momentum + volume);
  // fall back to a VIX-only proxy if the snapshot was generated without it.
  const fg = s.fear_greed?.score ?? vixToScore(s.vix.current);
  const fgMeta = scoreLabel(fg);
  const fgSource: "full" | "vix-only" = s.fear_greed ? "full" : "vix-only";
  const breadth = s.breadth.above_pct;
  const risk = computeRiskOnOff(s.sectors);
  const verdict = computeVerdict(fg, breadth, risk.score);

  const vixHistory = s.vix.history.map((h) => ({ date: h.date.slice(5), close: h.close }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">센티먼트</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          공포&amp;탐욕 · 시장 폭 · 섹터 회전 · 뉴스 · 시장 심리 종합 진단
        </p>
      </header>

      {/* ═══ Section 0: 오늘의 판정 (30초 요약) ═══ */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <CardTitle className="text-lg">오늘의 시장 판정</CardTitle>
            <Badge variant="secondary" className={cn("text-[10px]", verdict.color)}>
              {verdict.label}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            공포&amp;탐욕 · 시장 폭 · 섹터 회전을 가중 결합한 종합 판단
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5 text-sm">
            {verdict.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            💡 <strong className="text-foreground">읽는 순서</strong>: 오늘의 판정 → 공포·탐욕 게이지 → 시장 폭·VIX → 섹터 회전 → 뉴스
          </p>
        </CardContent>
      </Card>

      {/* ═══ Section 1: Fear & Greed Gauge ═══ */}
      <section>
        <SectionHeader
          title="1. 공포 & 탐욕 지수"
          why="시장 참여자의 심리 상태를 하나의 숫자로. 75+ = 과열(조정 위험) · 25- = 공포(역발상 기회)."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-6">
            <div className="text-center">
              <div className={cn("text-7xl font-bold tabular-nums", fgMeta.color)}>
                {Math.round(fg)}
              </div>
              <div className={cn("mt-1 text-lg font-semibold", fgMeta.color)}>
                {fgMeta.label}
              </div>
              {fgSource === "vix-only" && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  ⚠️ VIX 단일 지표 프록시 (모멘텀·거래량 컴포넌트 미포함)
                </div>
              )}
            </div>
            <div className="relative h-3 w-full max-w-md overflow-hidden rounded-full bg-gradient-to-r from-destructive via-amber-400 to-success">
              <div
                className="absolute top-0 h-full w-1 bg-foreground shadow-lg"
                style={{ left: `${fg}%`, transform: "translateX(-50%)" }}
              />
            </div>
            <div className="flex w-full max-w-md justify-between text-[10px] text-muted-foreground">
              <span>Extreme Fear (0)</span>
              <span>Neutral (50)</span>
              <span>Extreme Greed (100)</span>
            </div>

            {/* Component breakdown (only when full F&G is available) */}
            {s.fear_greed && (
              <div className="grid w-full max-w-md grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-md border border-border/40 bg-card/40 px-2 py-1.5">
                  <div className="text-muted-foreground">VIX</div>
                  <div className="mt-0.5 font-mono font-semibold">
                    {s.fear_greed.vix_score?.toFixed(0) ?? "-"}
                  </div>
                </div>
                <div className="rounded-md border border-border/40 bg-card/40 px-2 py-1.5">
                  <div className="text-muted-foreground">모멘텀</div>
                  <div className="mt-0.5 font-mono font-semibold">
                    {s.fear_greed.momentum_score?.toFixed(0) ?? "-"}
                  </div>
                </div>
                <div className="rounded-md border border-border/40 bg-card/40 px-2 py-1.5">
                  <div className="text-muted-foreground">거래량</div>
                  <div className="mt-0.5 font-mono font-semibold">
                    {s.fear_greed.volume_score?.toFixed(0) ?? "-"}
                  </div>
                </div>
              </div>
            )}

            <div className={cn("mt-1 rounded-lg px-3 py-1.5 text-xs", fgMeta.bg, fgMeta.color)}>
              {fg >= 75 ? "⚠️ 과열 국면 · 급락 위험 증가"
               : fg >= 55 ? "🟢 상승 심리 우세 · 추세 유지"
               : fg >= 45 ? "◆ 방향성 없음 · 관망"
               : fg >= 25 ? "🟡 심리 위축 · 저점 형성 관찰"
               : "🚨 극단적 공포 · 역발상 매수 후보 (경험적으로 3-6개월 뒤 반등)"}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══ Section 2: Market Breadth + VIX ═══ */}
      <section>
        <SectionHeader
          title="2. 시장 폭 & 변동성"
          why="폭(Breadth) = 상승 참여 종목 비율. VIX = 향후 30일 변동성 기대치. 이 둘의 조합으로 랠리의 건강성 판단."
        />
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">시장 폭 (Breadth)</CardTitle>
              <CardDescription className="text-xs">S&amp;P 500 · 200일선 위 종목 비율</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="text-center">
                <div className="text-5xl font-bold tabular-nums text-primary">
                  {breadth.toFixed(1)}%
                </div>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted/40">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, breadth))}%` }}
                />
              </div>
              <div className="text-center text-xs text-muted-foreground">
                {breadth >= 60 ? "🟢 광범위한 참여 · 건강한 상승" :
                 breadth >= 40 ? "◆ 선두 종목 편중 · 상승 폭 좁음" :
                 "🔴 대부분 종목 하락세 · 시장 약세"}
              </div>
              <p className="mt-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                <strong className="text-foreground">왜 봐야:</strong> 지수는 오르는데 참여 종목이 줄면 상승 지속성 약화 (Narrow Rally 신호).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">VIX (변동성 지수)</CardTitle>
              <CardDescription className="text-xs">
                현재 {s.vix.current.toFixed(2)} · 6M 평균 {s.vix.avg.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VixChart data={vixHistory} />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={cn(
                  "font-semibold",
                  s.vix.current < 15 ? "text-success" :
                  s.vix.current < 20 ? "text-muted-foreground" :
                  s.vix.current < 30 ? "text-amber-400" : "text-destructive",
                )}>
                  {s.vix.current < 15 ? "🟢 안정 (< 15)" :
                   s.vix.current < 20 ? "◆ 정상 (15-20)" :
                   s.vix.current < 30 ? "🟡 경계 (20-30)" :
                   "🚨 공포 (> 30)"}
                </span>
                <span className="text-muted-foreground">
                  6M 범위: {s.vix.min.toFixed(1)} - {s.vix.max.toFixed(1)}
                </span>
              </div>
              <p className="mt-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                <strong className="text-foreground">왜 봐야:</strong> VIX 급등 = 옵션 시장이 큰 변동 예상. 20 이상 = 조정 국면, 30+ = 위기.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══ Section 3: Sector Rotation + Risk On/Off ═══ */}
      <section>
        <SectionHeader
          title="3. 섹터 회전 & 위험 선호도"
          why="자금이 경기순환주(XLY/XLK/XLC/XLF/XLI)로 가면 Risk-On, 방어주(XLP/XLU/XLV/XLRE)로 가면 Risk-Off. 큰 흐름 감지."
        />
        <div className="flex flex-col gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Risk-On / Risk-Off</CardTitle>
              <CardDescription className="text-xs">
                순환주 1M 평균 − 방어주 1M 평균 = <strong className={cn(
                  risk.tone === "risk-on" ? "text-success" :
                  risk.tone === "risk-off" ? "text-destructive" : "text-foreground",
                )}>{risk.score >= 0 ? "+" : ""}{risk.score.toFixed(2)}%p</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/40 bg-card/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    순환주 평균 (XLY·XLK·XLC·XLF·XLI)
                  </div>
                  <div className={cn(
                    "mt-1 text-2xl font-bold tabular-nums",
                    risk.cyclicalAvg >= 0 ? "text-success" : "text-destructive",
                  )}>
                    {risk.cyclicalAvg >= 0 ? "+" : ""}{risk.cyclicalAvg.toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-lg border border-border/40 bg-card/40 p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    방어주 평균 (XLP·XLU·XLV·XLRE)
                  </div>
                  <div className={cn(
                    "mt-1 text-2xl font-bold tabular-nums",
                    risk.defensiveAvg >= 0 ? "text-success" : "text-destructive",
                  )}>
                    {risk.defensiveAvg >= 0 ? "+" : ""}{risk.defensiveAvg.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold text-center",
                risk.tone === "risk-on" ? "bg-success/10 text-success" :
                risk.tone === "risk-off" ? "bg-destructive/10 text-destructive" :
                "bg-muted/20 text-muted-foreground",
              )}>
                {risk.tone === "risk-on" ? "🟢 Risk-On — 위험자산 선호 국면" :
                 risk.tone === "risk-off" ? "🔴 Risk-Off — 안전자산 선호 국면" :
                 "◆ Mixed — 뚜렷한 방향성 없음"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">11개 섹터 성과 (1W · 1M)</CardTitle>
              <CardDescription className="text-xs">
                SPDR 섹터 ETF · 성과 순 정렬 · 상위/하위로 자금 이동 방향 확인
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SectorStrip sectors={s.sectors} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══ Section 4: Market News ═══ */}
      <section>
        <SectionHeader
          title="4. 시장 헤드라인"
          why="숫자 지표로는 잡히지 않는 이벤트 · 정책 · 실적 반응. 지표 해석의 배경 맥락."
        />
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
                {marketNews.slice(0, 15).map((n, i) => (
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
            <p className="mt-3 text-[11px] text-muted-foreground">
              종목별 뉴스는 <a href="/stock" className="text-primary hover:underline">종목 상세 페이지</a>에서 검색 후 확인.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────

function SectionHeader({ title, why }: { title: string; why: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{why}</p>
    </div>
  );
}
