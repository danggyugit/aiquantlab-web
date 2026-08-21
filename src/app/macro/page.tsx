import { getMarketSnapshot, type Commodity } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VixChart } from "./vix-chart";

export const metadata = { title: "매크로 · AI Quant Lab" };
export const revalidate = 900;

function pctChangeVsAvg(c: Commodity): number {
  return ((c.current - c.avg) / c.avg) * 100;
}

export default async function MacroPage() {
  const s = await getMarketSnapshot();

  // Explicit label override (Commodity.label is short; we want the full name for macro view).
  const commodities = [
    { key: "dxy", ...s.commodities.dxy, label: "US Dollar Index", unit: "" },
    { key: "gold", ...s.commodities.gold, label: "Gold", unit: "$/oz" },
    { key: "oil_wti", ...s.commodities.oil_wti, label: "WTI Crude Oil", unit: "$/bbl" },
  ];

  const vixHistory = s.vix.history.map((h) => ({ date: h.date.slice(5), close: h.close }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">매크로</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          변동성·상품·시장 폭 종합. FRED 기반 금리·유동성·인플레이션 지표는 확장 예정.
        </p>
      </header>

      {/* Commodities */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">상품 & 환율</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {commodities.map((c) => (
            <MetricCard
              key={c.key}
              label={c.label}
              value={c.current.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              unit={c.unit}
              change={pctChangeVsAvg(c)}
            />
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {commodities.map((c) => (
            <div key={c.key} className="rounded-lg border border-border/40 bg-card/40 p-3 text-xs">
              <div className="text-muted-foreground">
                {c.label} · 6M 범위
              </div>
              <div className="mt-1 flex justify-between font-mono tabular-nums">
                <span>Low: {c.min.toFixed(2)}</span>
                <span>Avg: {c.avg.toFixed(2)}</span>
                <span>High: {c.max.toFixed(2)}</span>
              </div>
              <div className="mt-1 text-muted-foreground">추세: <span className="text-foreground">{c.trend}</span></div>
            </div>
          ))}
        </div>
      </section>

      {/* VIX chart */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">VIX (변동성 지수)</h2>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-baseline gap-4">
              <span className="text-3xl font-bold tabular-nums text-primary">{s.vix.current.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">
                6M 평균 {s.vix.avg.toFixed(2)} · Low {s.vix.min.toFixed(2)} / High {s.vix.max.toFixed(2)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <VixChart data={vixHistory} />
          </CardContent>
        </Card>
      </section>

      {/* Market breadth */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">시장 폭 (Breadth)</h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">S&amp;P 500 vs 200일 이평선</CardTitle>
            <CardDescription>
              SPY {s.breadth.spy_close} · SMA200 {s.breadth.sma200} · 200일선 위 종목 비율 {s.breadth.above_pct}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, s.breadth.above_pct))}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">확장 계획:</strong> FRED API 연동 후 유동성(M2, RRP, TGA), 금리(2Y/10Y),
        인플레이션(CPI, PCE) 시계열이 추가됩니다. 백엔드(FastAPI 또는 Next.js Route Handler) 도입 필요.
      </div>
    </div>
  );
}
