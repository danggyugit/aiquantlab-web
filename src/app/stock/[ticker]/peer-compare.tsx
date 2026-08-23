import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Fundamental, HeatmapTicker, StockMeta } from "@/lib/data";

/**
 * Peer comparison card — picks the top N same-industry names by market cap
 * (excluding this ticker) and shows valuation + growth + returns side-by-side.
 *
 * Uses ONLY our own cached data (stocks.json industry field · fundamentals.json
 * · heatmap.json returns) — no extra API calls. Fast + deterministic.
 */

type PeerRow = {
  ticker: string;
  name: string;
  marketCap: number;
  price: number | null;
  changePct: number | null;
  ret1m: number | null;
  ret3m: number | null;
  ret1y: number | null;
  pe: number | null;
  pb: number | null;
  roe: number | null;
  divYield: number | null;
  isSelf: boolean;
};

export function PeerComparisonCard({
  ticker,
  meta,
  stocks,
  heatmapTickers,
  fundamentalsTickers,
  n = 5,
}: {
  ticker: string;
  meta: StockMeta;
  stocks: StockMeta[];
  heatmapTickers: Record<string, HeatmapTicker>;
  fundamentalsTickers: Record<string, Fundamental>;
  n?: number;
}) {
  if (!meta.industry) {
    return null;
  }

  // Collect all peers in the same industry (including self)
  const peersInIndustry = stocks.filter((s) => s.industry === meta.industry);
  if (peersInIndustry.length < 2) return null;

  // Build rows with data, sort by market cap desc, take top N + ensure self is in
  const enriched: PeerRow[] = peersInIndustry
    .map<PeerRow | null>((s) => {
      const hm = heatmapTickers[s.ticker];
      const f = fundamentalsTickers[s.ticker];
      if (!hm) return null;
      const lastPrice = hm.prices?.[hm.prices.length - 1]?.close ?? null;
      const prevPrice = hm.prices?.[hm.prices.length - 2]?.close ?? null;
      const changePct = lastPrice && prevPrice ? ((lastPrice - prevPrice) / prevPrice) * 100 : null;
      const r = hm.returns ?? {};
      return {
        ticker: s.ticker,
        name: s.name,
        marketCap: hm.market_cap ?? 0,
        price: lastPrice,
        changePct,
        ret1m: typeof r["1m"] === "number" ? r["1m"] : null,
        ret3m: typeof r["3m"] === "number" ? r["3m"] : null,
        ret1y: typeof r["1y"] === "number" ? r["1y"] : null,
        pe: f?.pe_ratio && f.pe_ratio > 0 ? f.pe_ratio : null,
        pb: f?.pb_ratio ?? null,
        roe: f?.roe !== null && f?.roe !== undefined ? f.roe * 100 : null,
        divYield: f?.dividend_yield && f.dividend_yield > 0 ? f.dividend_yield : null,
        isSelf: s.ticker === ticker,
      };
    })
    .filter((x): x is PeerRow => x !== null)
    .sort((a, b) => b.marketCap - a.marketCap);

  // Take top N by market cap, plus self if not already in the top N
  const topN = enriched.slice(0, n);
  const self = enriched.find((r) => r.isSelf);
  const rows = topN.some((r) => r.isSelf) || !self ? topN : [...topN.slice(0, n - 1), self];

  // Industry averages (across ALL peers in industry, not just top-N)
  const avg = (key: keyof PeerRow): number | null => {
    const vals = enriched.map((r) => r[key]).filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };
  const industryAvg = {
    pe: avg("pe"),
    pb: avg("pb"),
    roe: avg("roe"),
    ret3m: avg("ret3m"),
    ret1y: avg("ret1y"),
    divYield: avg("divYield"),
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">🥊 경쟁사 비교</CardTitle>
        <CardDescription className="text-xs">
          {meta.industry} · 시가총액 상위 {rows.length}개 · 산업 평균 대비 저평가·고평가 즉시 판단
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 bg-muted/20 text-left text-[10px] text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">Ticker</th>
                <th className="px-2 py-1.5 hidden sm:table-cell">시가총액</th>
                <th className="px-2 py-1.5 text-right">P/E</th>
                <th className="px-2 py-1.5 text-right">P/B</th>
                <th className="px-2 py-1.5 text-right hidden md:table-cell">ROE</th>
                <th className="px-2 py-1.5 text-right">3M</th>
                <th className="px-2 py-1.5 text-right hidden md:table-cell">1Y</th>
                <th className="px-2 py-1.5 text-right hidden lg:table-cell">배당%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ticker}
                  className={cn(
                    "border-b border-border/30",
                    r.isSelf ? "bg-primary/10" : "hover:bg-muted/20",
                  )}
                >
                  <td className="px-2 py-1.5 font-mono text-xs font-semibold">
                    {r.isSelf ? (
                      <span className="text-primary">{r.ticker} ★</span>
                    ) : (
                      <Link href={`/stock/${r.ticker}`} className="text-primary hover:underline">
                        {r.ticker}
                      </Link>
                    )}
                    <div className="mt-0.5 text-[9px] font-normal text-muted-foreground truncate max-w-[140px]">{r.name}</div>
                  </td>
                  <td className="px-2 py-1.5 hidden sm:table-cell text-muted-foreground">{fmtCap(r.marketCap)}</td>
                  <ValueCell value={r.pe} format="mul" benchmark={industryAvg.pe} lowerBetter />
                  <ValueCell value={r.pb} format="mul" benchmark={industryAvg.pb} lowerBetter />
                  <ValueCell value={r.roe} format="pct" benchmark={industryAvg.roe} className="hidden md:table-cell" />
                  <ValueCell value={r.ret3m} format="pct" tone="signed" />
                  <ValueCell value={r.ret1y} format="pct" tone="signed" className="hidden md:table-cell" />
                  <ValueCell value={r.divYield} format="pct" className="hidden lg:table-cell" />
                </tr>
              ))}
              {/* Industry average row */}
              <tr className="border-t-2 border-border/60 bg-muted/10">
                <td className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">산업 평균</td>
                <td className="px-2 py-1.5 hidden sm:table-cell text-[10px] text-muted-foreground">
                  {enriched.length}개 종목
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtMul(industryAvg.pe)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtMul(industryAvg.pb)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground hidden md:table-cell">{fmtPct(industryAvg.roe)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtPct(industryAvg.ret3m)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground hidden md:table-cell">{fmtPct(industryAvg.ret1y)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground hidden lg:table-cell">{fmtPct(industryAvg.divYield)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          ★ = 현재 종목. 색상 = 산업 평균 대비 (녹색: P/E·P/B는 저평가 / ROE는 높음, 빨강: 반대).
        </p>
      </CardContent>
    </Card>
  );
}

function ValueCell({
  value,
  format,
  benchmark,
  lowerBetter,
  tone,
  className,
}: {
  value: number | null;
  format: "mul" | "pct";
  benchmark?: number | null;
  /** For metrics where lower is better (PE/PB). Higher-better if false/omitted. */
  lowerBetter?: boolean;
  /** "signed" = colour by sign (returns), otherwise colour vs benchmark. */
  tone?: "signed";
  className?: string;
}) {
  if (value === null || !Number.isFinite(value)) {
    return <td className={cn("px-2 py-1.5 text-right text-muted-foreground/60", className)}>-</td>;
  }
  const display = format === "mul" ? `${value.toFixed(1)}x` : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  let color = "text-foreground";
  if (tone === "signed") {
    color = value >= 0 ? "text-success" : "text-destructive";
  } else if (benchmark !== null && benchmark !== undefined && Number.isFinite(benchmark)) {
    const isBetter = lowerBetter ? value < benchmark : value > benchmark;
    color = isBetter ? "text-success" : "text-destructive";
  }
  return (
    <td className={cn("px-2 py-1.5 text-right tabular-nums font-semibold", color, className)}>
      {display}
    </td>
  );
}

function fmtCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toFixed(0)}`;
}
function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}
function fmtMul(v: number | null): string {
  if (v === null || !Number.isFinite(v) || v <= 0) return "-";
  return `${v.toFixed(1)}x`;
}
