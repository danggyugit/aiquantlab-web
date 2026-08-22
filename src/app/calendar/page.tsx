import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { getStocksMeta } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "캘린더 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 7_Calendar.py — 3 tabs:
 *   1. Monthly view (7-col grid, each cell shows events)
 *   2. Economic Events (Finnhub — importance filter)
 *   3. Earnings (Finnhub/yfinance — ticker filter)
 *
 * Streamlit uses live Finnhub API. We generate placeholder earnings
 * distributed deterministically by ticker hash until a backend proxy
 * is available.
 */

const IMPORTANCE_ORDER = ["high", "medium", "low"] as const;
type Importance = (typeof IMPORTANCE_ORDER)[number];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function monthName(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// Build a 7-col × ~5-row grid for the current month.
function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month - 1, 1);
  const firstDayOfWeek = (first.getDay() + 6) % 7; // Mon=0
  const lastDate = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default async function CalendarPage() {
  const stocks = await getStocksMeta();
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthLabel = monthName(year, month);
  const grid = buildMonthGrid(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  // ── Placeholder earnings distribution ──
  const earningsByDay: Record<number, Array<{ ticker: string; name: string; when: "BMO" | "AMC" }>> = {};
  for (const s of stocks) {
    const h = hashCode(s.ticker);
    if (h % 6 !== 0) continue;
    const day = (h % daysInMonth) + 1;
    if (!earningsByDay[day]) earningsByDay[day] = [];
    earningsByDay[day].push({
      ticker: s.ticker,
      name: s.name,
      when: h % 2 === 0 ? "BMO" : "AMC",
    });
  }

  // Placeholder economic events (a few notable ones per month, colored by importance)
  const economicEvents: Array<{
    date: number;
    name: string;
    importance: Importance;
    actual?: string;
    forecast?: string;
    previous?: string;
  }> = [
    { date: 3, name: "ISM Manufacturing PMI", importance: "high", forecast: "48.5", previous: "48.7" },
    { date: 5, name: "Nonfarm Payrolls", importance: "high", forecast: "165K", previous: "142K" },
    { date: 5, name: "Unemployment Rate", importance: "high", forecast: "4.2%", previous: "4.2%" },
    { date: 11, name: "CPI YoY", importance: "high", forecast: "2.5%", previous: "2.5%" },
    { date: 12, name: "PPI YoY", importance: "medium", forecast: "1.7%", previous: "1.7%" },
    { date: 17, name: "Retail Sales", importance: "medium", forecast: "+0.3%", previous: "+0.1%" },
    { date: 18, name: "FOMC Rate Decision", importance: "high", forecast: "5.25%", previous: "5.50%" },
    { date: 25, name: "Core PCE YoY", importance: "high", forecast: "2.7%", previous: "2.6%" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">캘린더</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          {monthLabel} · Streamlit 7_Calendar.py 미러링 (Finnhub 프록시 연동 대기)
        </p>
      </header>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
        <AlertCircle className="mr-1 inline h-3 w-3 text-amber-400" />
        <strong className="text-amber-400">Placeholder 데이터:</strong> Streamlit은 Finnhub API로 실제 어닝/경제지표를 가져옵니다.
        여기는 티커 해시 기반 임의 분배로 UI 구조만 표시. 백엔드 프록시(Finnhub API key) 도입 후 실제 데이터 연결.
      </div>

      <Tabs defaultValue="monthly">
        <TabsList className="flex gap-1 bg-transparent p-0">
          <TabsTrigger value="monthly" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            월간달력
          </TabsTrigger>
          <TabsTrigger value="economic" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            경제지표
          </TabsTrigger>
          <TabsTrigger value="earnings" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            실적캘린더
          </TabsTrigger>
        </TabsList>

        {/* ═══ Tab 1: Monthly Grid ═══ */}
        <TabsContent value="monthly" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{monthLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {/* 7-col header */}
              <div className="grid grid-cols-7 gap-1 border-b border-border/40 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              {/* Weeks */}
              <div className="mt-1 flex flex-col gap-1">
                {grid.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((day, di) => {
                      const isToday = day === today.getDate();
                      const econ = day ? economicEvents.filter((e) => e.date === day) : [];
                      const earns = day ? (earningsByDay[day] ?? []) : [];
                      const events = [...econ, ...earns.slice(0, 3)];
                      const overflow = earns.length > 3 ? earns.length - 3 : 0;
                      return (
                        <div
                          key={di}
                          className={cn(
                            "min-h-[100px] rounded border p-1.5 text-[10px]",
                            day
                              ? isToday
                                ? "border-primary/60 bg-primary/10"
                                : "border-border/40 bg-card/40"
                              : "border-transparent bg-muted/10",
                          )}
                        >
                          {day && (
                            <>
                              <div
                                className={cn(
                                  "mb-1 text-xs font-semibold",
                                  isToday ? "text-primary" : "text-foreground",
                                )}
                              >
                                {day}
                              </div>
                              {events.length === 0 ? (
                                <div className="text-[9px] text-muted-foreground/50">-</div>
                              ) : (
                                <div className="flex flex-col gap-0.5">
                                  {events.map((e, i) => {
                                    if ("importance" in e) {
                                      return (
                                        <div key={i} className="flex items-center gap-1 truncate">
                                          <span className="shrink-0">{importanceEmoji(e.importance)}</span>
                                          <span className="truncate">{e.name}</span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <Link
                                        key={i}
                                        href={`/stock/${e.ticker}`}
                                        className="flex items-center gap-1 truncate font-mono text-primary hover:underline"
                                      >
                                        📊 {e.ticker}
                                      </Link>
                                    );
                                  })}
                                  {overflow > 0 && (
                                    <div className="text-[9px] text-muted-foreground">+{overflow} more</div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-3 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                <span>🔴 High</span>
                <span>🟠 Medium</span>
                <span>⚪ Low</span>
                <span>📊 Earnings</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Tab 2: Economic Events ═══ */}
        <TabsContent value="economic" className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(["high", "medium", "low"] as Importance[]).map((imp) => (
              <Badge
                key={imp}
                variant="secondary"
                className={cn(
                  "text-[10px] cursor-default",
                  imp === "high" ? "bg-destructive/20 text-destructive"
                    : imp === "medium" ? "bg-amber-500/20 text-amber-400"
                    : "bg-muted/40 text-muted-foreground",
                )}
              >
                {importanceEmoji(imp)} {imp.toUpperCase()}
              </Badge>
            ))}
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">중요도</th>
                    <th className="px-3 py-2">날짜</th>
                    <th className="px-3 py-2">이벤트</th>
                    <th className="px-3 py-2 text-right">Actual</th>
                    <th className="px-3 py-2 text-right">Forecast</th>
                    <th className="px-3 py-2 text-right">Previous</th>
                  </tr>
                </thead>
                <tbody>
                  {economicEvents.map((e, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="px-3 py-2">{importanceEmoji(e.importance)}</td>
                      <td className="px-3 py-2 tabular-nums">{monthLabel.slice(0, 3)} {e.date}</td>
                      <td className="px-3 py-2 font-medium">{e.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.actual ?? "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.forecast ?? "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.previous ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ═══ Tab 3: Earnings ═══ */}
        <TabsContent value="earnings" className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {Object.values(earningsByDay).reduce((a, b) => a + b.length, 0)}개 실적 발표 예정
          </p>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">발표일</th>
                    <th className="px-3 py-2">Ticker</th>
                    <th className="px-3 py-2">회사</th>
                    <th className="px-3 py-2">시간</th>
                    <th className="px-3 py-2 text-right">EPS 추정</th>
                    <th className="px-3 py-2 text-right">매출 추정</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(earningsByDay)
                    .flatMap(([day, list]) => list.map((e) => ({ ...e, day: parseInt(day) })))
                    .sort((a, b) => a.day - b.day || a.ticker.localeCompare(b.ticker))
                    .slice(0, 100)
                    .map((e, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {monthLabel.slice(0, 3)} {e.day}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs font-semibold">
                          <Link href={`/stock/${e.ticker}`} className="text-primary hover:underline">{e.ticker}</Link>
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-2">{e.name}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[9px]",
                              e.when === "BMO"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-primary/15 text-primary",
                            )}
                          >
                            {e.when}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">-</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function importanceEmoji(imp: Importance): string {
  return imp === "high" ? "🔴" : imp === "medium" ? "🟠" : "⚪";
}
