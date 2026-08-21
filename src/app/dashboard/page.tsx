import { getMarketSnapshot } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { MetricCard } from "@/components/metric-card";
import { SectorStrip } from "@/components/sector-strip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const metadata = { title: "Dashboard · AI Quant Lab" };

export default async function DashboardPage() {
  const s = await getMarketSnapshot();

  const spyChangePct = ((s.breadth.spy_close - s.breadth.sma200) / s.breadth.sma200) * 100;
  const vixChangePct = ((s.vix.current - s.vix.avg) / s.vix.avg) * 100;
  const goldChangePct = ((s.commodities.gold.current - s.commodities.gold.avg) / s.commodities.gold.avg) * 100;
  const oilChangePct =
    ((s.commodities.oil_wti.current - s.commodities.oil_wti.avg) / s.commodities.oil_wti.avg) * 100;

  const updatedAt = new Date(s.updated_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1>
          <MarketBadge />
        </div>
        <p className="text-xs text-muted-foreground">Updated {updatedAt} KST</p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Market Snapshot</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="SPY" value={s.breadth.spy_close.toLocaleString()} change={spyChangePct} />
          <MetricCard label="VIX" value={s.vix.current.toFixed(2)} change={vixChangePct} />
          <MetricCard label="Gold" value={s.commodities.gold.current.toLocaleString()} change={goldChangePct} />
          <MetricCard label="WTI Oil" value={s.commodities.oil_wti.current.toFixed(2)} change={oilChangePct} />
        </div>
      </section>

      <Separator />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Sector Performance</h2>
        <SectorStrip sectors={s.sectors} />
      </section>

      <Separator />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Market Breadth</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">S&amp;P 500 vs 200-day SMA</CardTitle>
            <CardDescription>
              SPY 종가 {s.breadth.spy_close} · SMA200 {s.breadth.sma200} · 200일선 위 종목 비율{" "}
              {s.breadth.above_pct}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, s.breadth.above_pct))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {s.breadth.above_pct < 30
                ? "약세 시장 (200일선 위 종목이 30% 미만)"
                : s.breadth.above_pct < 50
                  ? "중립"
                  : "강세 시장 (200일선 위 종목이 50% 이상)"}
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
