import { getFundamentals, getStocksMeta } from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { ScreenerClient, type ScreenerRow } from "./screener-client";

export const metadata = { title: "스크리너 · AI Quant Lab" };
export const revalidate = 900;

export default async function ScreenerPage() {
  const [fund, stocks] = await Promise.all([getFundamentals(), getStocksMeta()]);

  // Join meta + fundamentals by ticker.
  const rows: ScreenerRow[] = stocks
    .map((s) => {
      const f = fund.tickers[s.ticker];
      if (!f) return null;
      return {
        ticker: s.ticker,
        name: s.name,
        sector: s.sector,
        industry: s.industry,
        cap_tier: s.cap_tier,
        pe_ratio: f.pe_ratio,
        pb_ratio: f.pb_ratio,
        roe: f.roe,
        dividend_yield: f.dividend_yield,
        beta: f.beta,
        debt_to_equity: f.debt_to_equity,
      } satisfies ScreenerRow;
    })
    .filter((r): r is ScreenerRow => r !== null);

  const sectors = Array.from(new Set(rows.map((r) => r.sector))).filter(Boolean).sort();

  const updatedAt = new Date(fund.updated_at).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">스크리너</h1>
          <MarketBadge />
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {updatedAt} KST · {rows.length.toLocaleString()} S&amp;P500 종목 펀더멘털
        </p>
      </header>

      <ScreenerClient rows={rows} sectors={sectors} />
    </div>
  );
}
