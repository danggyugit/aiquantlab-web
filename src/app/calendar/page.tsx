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
 * Calendar — 3 tabs. Server component fetches Finnhub via FastAPI proxy
 * (POST /finnhub/earnings-calendar + /finnhub/economic-calendar). If the
 * proxy is unavailable (missing key or Render cold-start timeout) we fall
 * back to a placeholder distribution so the UI structure stays testable.
 */

const IMPORTANCE_ORDER = ["high", "medium", "low"] as const;
type Importance = (typeof IMPORTANCE_ORDER)[number];

type EarningsRow = {
  ticker: string;
  name: string;
  day: number;              // day-of-month (from event date)
  when: "BMO" | "AMC" | "DMH";
  epsEst?: number | null;
  revEst?: number | null;
};

type EconomicRow = {
  day: number;
  date: string;             // ISO
  name: string;
  importance: Importance;
  actual?: string | null;
  forecast?: string | null;
  previous?: string | null;
};

function monthName(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

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

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 1800 }, // 30 min
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function normalizeWhen(hour: string | null | undefined): "BMO" | "AMC" | "DMH" {
  // Finnhub: "bmo" | "amc" | "dmh" | "" | null
  const h = (hour ?? "").toLowerCase();
  if (h === "bmo") return "BMO";
  if (h === "amc") return "AMC";
  return "DMH";
}

function normalizeImportance(x: string | number | null | undefined): Importance {
  const s = String(x ?? "").toLowerCase();
  if (s === "high" || s === "3") return "high";
  if (s === "medium" || s === "2") return "medium";
  return "low";
}

export default async function CalendarPage() {
  const stocks = await getStocksMeta();
  const stocksByTicker = new Map(stocks.map((s) => [s.ticker, s]));
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthLabel = monthName(year, month);
  const grid = buildMonthGrid(year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

  // ── Fetch real data (parallel) ────────────────────────────────────
  const [earningsRaw, econRaw] = apiBase
    ? await Promise.all([
        fetchJson<Array<{ symbol: string; date: string; hour: string | null; epsEstimate: number | null; revenueEstimate: number | null }>>(
          `${apiBase}/finnhub/earnings-calendar?from_date=${fromDate}&to_date=${toDate}`,
        ),
        fetchJson<Array<{ event: string; time?: string; date?: string; impact?: string | number; country?: string; actual?: string | number; estimate?: string | number; prev?: string | number; unit?: string }>>(
          `${apiBase}/finnhub/economic-calendar?from_date=${fromDate}&to_date=${toDate}`,
        ),
      ])
    : [null, null];

  const usingRealData = earningsRaw !== null || econRaw !== null;

  // ── Build earnings rows ───────────────────────────────────────────
  let earnings: EarningsRow[] = [];
  if (earningsRaw) {
    // Filter to S&P universe (avoid drowning in penny stocks)
    for (const e of earningsRaw) {
      const meta = stocksByTicker.get(e.symbol);
      if (!meta) continue;
      const day = parseInt(e.date.split("-")[2] ?? "0", 10);
      if (!day) continue;
      earnings.push({
        ticker: e.symbol,
        name: meta.name,
        day,
        when: normalizeWhen(e.hour),
        epsEst: e.epsEstimate,
        revEst: e.revenueEstimate,
      });
    }
  } else {
    // Fallback: deterministic distribution by ticker hash (Streamlit-parity UX)
    for (const s of stocks) {
      const h = hashCode(s.ticker);
      if (h % 6 !== 0) continue;
      const day = (h % daysInMonth) + 1;
      earnings.push({
        ticker: s.ticker,
        name: s.name,
        day,
        when: h % 2 === 0 ? "BMO" : "AMC",
      });
    }
  }
  earnings.sort((a, b) => a.day - b.day || a.ticker.localeCompare(b.ticker));

  // ── Build economic events ─────────────────────────────────────────
  let economicEvents: EconomicRow[] = [];
  if (econRaw) {
    for (const e of econRaw) {
      const country = (e.country ?? "US").toUpperCase();
      if (country && country !== "US") continue;
      // date may be in `date` field or first half of `time`
      let dateIso: string | undefined = e.date;
      if (!dateIso && e.time) dateIso = e.time.split(" ")[0];
      if (!dateIso) continue;
      const day = parseInt(dateIso.split("-")[2] ?? "0", 10);
      if (!day) continue;
      economicEvents.push({
        day,
        date: dateIso,
        name: e.event,
        importance: normalizeImportance(e.impact),
        actual: e.actual === undefined || e.actual === null ? null : String(e.actual),
        forecast: e.estimate === undefined || e.estimate === null ? null : String(e.estimate),
        previous: e.prev === undefined || e.prev === null ? null : String(e.prev),
      });
    }
    economicEvents.sort((a, b) => a.day - b.day);
  } else {
    // Fallback: hard-coded common US events for the month
    economicEvents = [
      { day: 3, date: `${fromDate.slice(0, 7)}-03`, name: "ISM Manufacturing PMI", importance: "high", forecast: "48.5", previous: "48.7" },
      { day: 5, date: `${fromDate.slice(0, 7)}-05`, name: "Nonfarm Payrolls", importance: "high", forecast: "165K", previous: "142K" },
      { day: 5, date: `${fromDate.slice(0, 7)}-05`, name: "Unemployment Rate", importance: "high", forecast: "4.2%", previous: "4.2%" },
      { day: 11, date: `${fromDate.slice(0, 7)}-11`, name: "CPI YoY", importance: "high", forecast: "2.5%", previous: "2.5%" },
      { day: 12, date: `${fromDate.slice(0, 7)}-12`, name: "PPI YoY", importance: "medium", forecast: "1.7%", previous: "1.7%" },
      { day: 17, date: `${fromDate.slice(0, 7)}-17`, name: "Retail Sales", importance: "medium", forecast: "+0.3%", previous: "+0.1%" },
      { day: 18, date: `${fromDate.slice(0, 7)}-18`, name: "FOMC Rate Decision", importance: "high", forecast: "5.25%", previous: "5.50%" },
      { day: 25, date: `${fromDate.slice(0, 7)}-25`, name: "Core PCE YoY", importance: "high", forecast: "2.7%", previous: "2.6%" },
    ];
  }

  // Group earnings by day for the calendar grid
  const earningsByDay = new Map<number, EarningsRow[]>();
  for (const e of earnings) {
    const arr = earningsByDay.get(e.day) ?? [];
    arr.push(e);
    earningsByDay.set(e.day, arr);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">캘린더</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          {monthLabel} · {usingRealData ? "Finnhub 실시간 데이터" : "Placeholder 분배 (API 미연결)"}
        </p>
      </header>

      {!usingRealData && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
          <AlertCircle className="mr-1 inline h-3 w-3 text-amber-400" />
          <strong className="text-amber-400">Placeholder 데이터:</strong> Finnhub 프록시가 응답하지 않습니다. Render 환경변수에 <code className="rounded bg-black/30 px-1">FINNHUB_API_KEY</code>가 설정되었는지 확인하세요.
        </div>
      )}

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
              <div className="grid grid-cols-7 gap-1 border-b border-border/40 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {grid.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((day, di) => {
                      const isToday = day === today.getDate();
                      const econ = day ? economicEvents.filter((e) => e.day === day) : [];
                      const earns = day ? (earningsByDay.get(day) ?? []) : [];
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
                  {economicEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        이번 달 예정 이벤트가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    economicEvents.map((e, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-3 py-2">{importanceEmoji(e.importance)}</td>
                        <td className="px-3 py-2 tabular-nums">{e.date}</td>
                        <td className="px-3 py-2 font-medium">{e.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{e.actual ?? "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.forecast ?? "-"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{e.previous ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ═══ Tab 3: Earnings ═══ */}
        <TabsContent value="earnings" className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{earnings.length}개 실적 발표 예정 (S&P 유니버스)</p>
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
                  {earnings.slice(0, 100).map((e, i) => (
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
                            e.when === "BMO" ? "bg-amber-500/20 text-amber-400"
                              : e.when === "AMC" ? "bg-primary/15 text-primary"
                              : "bg-muted/40 text-muted-foreground",
                          )}
                        >
                          {e.when}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">
                        {e.epsEst !== null && e.epsEst !== undefined ? e.epsEst.toFixed(2) : "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                        {e.revEst ? `${(e.revEst / 1e9).toFixed(1)}B` : "-"}
                      </td>
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
