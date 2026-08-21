import Link from "next/link";
import { getSec13FMetadata, get13FFiling, type Filing13F } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtMarketCap } from "@/lib/data";

export const metadata = { title: "SEC Intelligence · AI Quant Lab" };
export const revalidate = 900;

/** Best-effort load of a 13F filing; returns null on 404 / missing file. */
async function tryFiling(cik: string, period: string): Promise<Filing13F | null> {
  try {
    return await get13FFiling(cik, period);
  } catch {
    return null;
  }
}

/** Compact number formatter for portfolio values (dollars). */
function fmtValue(usd?: number): string {
  if (!usd) return "-";
  return fmtMarketCap(usd);
}

export default async function SecIntelligencePage() {
  const meta = await getSec13FMetadata();
  const entries = Object.entries(meta["13f"] ?? {}).map(([cik, entry]) => ({
    cik,
    period: entry.latest_period,
    filed_date: entry.filed_date,
  }));

  // Try to load all filings — some CIKs may not have a corresponding file yet.
  const filings = (
    await Promise.all(entries.map(async (e) => ({ ...e, filing: await tryFiling(e.cik, e.period) })))
  ).filter((x): x is typeof x & { filing: Filing13F } => x.filing !== null);

  // Aggregate consensus: how many managers hold each ticker?
  const tickerCount = new Map<string, { count: number; managers: string[]; totalValue: number }>();
  for (const f of filings) {
    for (const h of f.filing.holdings) {
      if (!h.ticker) continue;
      const cur = tickerCount.get(h.ticker) ?? { count: 0, managers: [], totalValue: 0 };
      cur.count += 1;
      cur.managers.push(f.filing.manager || f.filing.name);
      cur.totalValue += h.value_usd ?? 0;
      tickerCount.set(h.ticker, cur);
    }
  }
  const consensus = Array.from(tickerCount.entries())
    .map(([ticker, v]) => ({ ticker, ...v }))
    .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
    .slice(0, 20);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">SEC Intelligence</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          유명 헤지펀드 13F 공시 홀딩 (총 {filings.length}개 매니저)
        </p>
      </header>

      {/* Consensus picks */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          컨센서스 종목 <span className="text-sm font-normal text-muted-foreground">Top 20</span>
        </h2>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Ticker</th>
                  <th className="px-3 py-2">보유 매니저 수</th>
                  <th className="hidden px-3 py-2 sm:table-cell">주요 매니저</th>
                  <th className="px-3 py-2 text-right">총 보유가치</th>
                </tr>
              </thead>
              <tbody>
                {consensus.map((c) => (
                  <tr key={c.ticker} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-primary">{c.ticker}</td>
                    <td className="px-3 py-2 tabular-nums">
                      <Badge variant="secondary" className="bg-primary/15 text-primary">
                        {c.count}명
                      </Badge>
                    </td>
                    <td className="hidden max-w-[280px] truncate px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                      {c.managers.slice(0, 3).join(", ")}
                      {c.managers.length > 3 && ` +${c.managers.length - 3}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtValue(c.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* Per-manager portfolios */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          매니저별 포트폴리오 <span className="text-sm font-normal text-muted-foreground">Top 10 holdings</span>
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {filings
            .sort((a, b) => (a.filing.manager || a.filing.name).localeCompare(b.filing.manager || b.filing.name))
            .map((f) => {
              const top = [...f.filing.holdings]
                .sort((a, b) => (b.pct_port ?? 0) - (a.pct_port ?? 0))
                .slice(0, 10);
              return (
                <Card key={f.cik}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {f.filing.manager || f.filing.name}
                        </CardTitle>
                        <CardDescription className="truncate text-xs">
                          {f.filing.name} · {f.filing.holdings.length} 종목
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {f.period}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full text-xs">
                      <tbody>
                        {top.map((h, i) => (
                          <tr key={`${h.cusip}-${i}`} className="border-b border-border/20 last:border-0">
                            <td className="py-1.5 pr-2 font-mono text-primary">{h.ticker || "-"}</td>
                            <td className="max-w-[160px] truncate py-1.5 pr-2 text-muted-foreground">
                              {h.company}
                            </td>
                            <td className="py-1.5 pr-2 text-right tabular-nums text-foreground">
                              {h.pct_port !== undefined ? `${h.pct_port.toFixed(1)}%` : "-"}
                            </td>
                            <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                              {fmtValue(h.value_usd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      Filed: {f.filed_date ?? "-"}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        데이터 출처: SEC EDGAR 13F-HR 공시 (분기별) · 정보 제공용, 투자 자문 아님
      </p>

      {/* Consensus link — future ticker page */}
      <div className="text-xs text-muted-foreground">
        컨센서스 종목 클릭 시 종목 상세로 이동하는 기능은 <Link href="/stock" className="text-primary hover:underline">Stock Detail</Link> 페이지 이식 후 활성화됩니다.
      </div>
    </div>
  );
}
