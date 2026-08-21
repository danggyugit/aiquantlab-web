import Link from "next/link";
import { getStocksMeta } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, AlertCircle } from "lucide-react";

export const metadata = { title: "캘린더 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Deterministic earnings/event placeholder — uses ticker hash to distribute
 * mock events across the upcoming week, so the UI has meaningful density
 * without pulling from Finnhub yet. Real data plugs in when the API is added.
 */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function upcomingDays(): Date[] {
  const days: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
}

export default async function CalendarPage() {
  const stocks = await getStocksMeta();

  // Placeholder earnings distribution — deterministic per session.
  // (Replace with real Finnhub `stock/earnings` after backend is added.)
  const days = upcomingDays();
  const eventsByDay = days.map(() => [] as { ticker: string; name: string; when: "BMO" | "AMC" }[]);

  for (const s of stocks) {
    const h = hashCode(s.ticker);
    const dayIdx = h % 7;
    // Roughly 1 in 6 tickers get an "event" so density is realistic
    if (h % 6 === 0) {
      eventsByDay[dayIdx].push({
        ticker: s.ticker,
        name: s.name,
        when: h % 2 === 0 ? "BMO" : "AMC",
      });
    }
  }

  // Sort each day and cap
  for (const day of eventsByDay) {
    day.sort((a, b) => a.ticker.localeCompare(b.ticker));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">캘린더</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          이번주 어닝 · 경제지표 발표 캘린더 (placeholder 데이터, 실제 API 연동 예정)
        </p>
      </header>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
        <AlertCircle className="mr-1 inline h-3 w-3 text-amber-400" />
        <strong className="text-amber-400">Placeholder:</strong> 아래 표시된 어닝 일정은 티커 해시 기반 임의 분배입니다.
        Finnhub API 연동 후 실제 발표 일정으로 대체됩니다.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {days.map((day, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">{fmtDay(day)}</CardTitle>
              </div>
              <CardDescription className="text-[10px]">
                {eventsByDay[i].length}개 발표 예정
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
                {eventsByDay[i].slice(0, 12).map((e) => (
                  <Link
                    key={e.ticker}
                    href={`/stock/${e.ticker}`}
                    className="flex items-center justify-between gap-1.5 rounded-md border border-border/30 px-1.5 py-1 text-xs transition-colors hover:bg-muted/30"
                    title={e.name}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-mono font-semibold text-primary">{e.ticker}</span>
                    </span>
                    <Badge
                      variant="secondary"
                      className={
                        e.when === "BMO"
                          ? "bg-amber-500/20 text-amber-400 text-[9px]"
                          : "bg-primary/15 text-primary text-[9px]"
                      }
                    >
                      {e.when}
                    </Badge>
                  </Link>
                ))}
                {eventsByDay[i].length > 12 && (
                  <div className="text-center text-[10px] text-muted-foreground">
                    +{eventsByDay[i].length - 12}개
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground">
        <div className="mb-2 font-semibold text-foreground">범례</div>
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 text-[9px]">BMO</Badge>
            Before Market Open (장전)
          </span>
          <span className="flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-primary/15 text-primary text-[9px]">AMC</Badge>
            After Market Close (장후)
          </span>
        </div>
      </div>
    </div>
  );
}
