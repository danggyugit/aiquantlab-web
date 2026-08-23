import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialFiling, FinnhubMetric } from "@/lib/finnhub";

/**
 * Deep-fundamentals section — three cards stacked:
 *
 *   ① 성장률 & 마진 (from /stock/metric)
 *   ② 재무제표 트렌드 (last 4-8 quarters — revenue · net income · FCF)
 *   ③ 고급 밸류에이션 (PEG · EV/EBITDA · P/FCF · P/S · Payout ratio)
 *
 * Everything is server-computed from Finnhub free-tier endpoints.
 */

const CONCEPT_MAP = {
  revenue: ["Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueGoodsNet"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  operatingIncome: ["OperatingIncomeLoss"],
  grossProfit: ["GrossProfit"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForPurchaseOfPropertyPlantAndEquipment"],
} as const;

function findConcept(items: FinancialFiling["report"]["ic"] | FinancialFiling["report"]["cf"], candidates: readonly string[]): number | null {
  if (!items) return null;
  for (const cand of candidates) {
    const match = items.find((it) => it.concept === cand);
    if (match && typeof match.value === "number") return match.value;
  }
  return null;
}

type QuarterlyRow = {
  period: string;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  fcf: number | null;
};

function buildQuarterly(filings: FinancialFiling[]): QuarterlyRow[] {
  return filings
    .slice(0, 8) // last 8 quarters
    .map((f) => {
      const revenue = findConcept(f.report.ic, CONCEPT_MAP.revenue);
      const grossProfit = findConcept(f.report.ic, CONCEPT_MAP.grossProfit);
      const operatingIncome = findConcept(f.report.ic, CONCEPT_MAP.operatingIncome);
      const netIncome = findConcept(f.report.ic, CONCEPT_MAP.netIncome);
      const ocf = findConcept(f.report.cf, CONCEPT_MAP.operatingCashFlow);
      const capex = findConcept(f.report.cf, CONCEPT_MAP.capex);
      // Capex is usually reported as positive outflow; subtract it from OCF.
      const fcf = ocf !== null && capex !== null ? ocf - Math.abs(capex) : ocf;
      return {
        period: f.endDate?.slice(0, 7) ?? `${f.year}Q${f.quarter}`,
        revenue,
        grossProfit,
        operatingIncome,
        netIncome,
        fcf,
      };
    })
    .reverse(); // oldest → newest for the bar chart
}

function fmtBig(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function fmtMul(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v) || v <= 0) return "-";
  return `${v.toFixed(1)}x`;
}

// ── Sub-components ─────────────────────────────────────────

function StatTile({
  label,
  value,
  hint,
  tone,
}: { label: string; value: string; hint?: string; tone?: "up" | "down" | "neutral" }) {
  const color = tone === "up" ? "text-success" : tone === "down" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-base font-bold tabular-nums", color)}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Growth + Margins card (Tier 1 #2, #3)
// ══════════════════════════════════════════════════════════

export function GrowthMarginsCard({ metric }: { metric: FinnhubMetric | null }) {
  if (!metric) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📈 성장률 & 마진</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Finnhub 메트릭 데이터가 없습니다 (커버리지 부재 또는 API 미연결).
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">📈 성장률 & 마진</CardTitle>
        <CardDescription className="text-xs">
          장기 성장 · 수익성 · 재무 건전성 스냅샷
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">성장률 (연평균)</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="매출 5Y" value={fmtPct(metric.revenueGrowth5Y as number | undefined)} tone={numTone(metric.revenueGrowth5Y as number | undefined)} />
            <StatTile label="매출 3Y" value={fmtPct(metric.revenueGrowth3Y as number | undefined)} tone={numTone(metric.revenueGrowth3Y as number | undefined)} />
            <StatTile label="EPS 5Y" value={fmtPct(metric.epsGrowth5Y as number | undefined)} tone={numTone(metric.epsGrowth5Y as number | undefined)} />
            <StatTile label="EPS 3Y" value={fmtPct(metric.epsGrowth3Y as number | undefined)} tone={numTone(metric.epsGrowth3Y as number | undefined)} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">마진 (TTM)</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="총 마진" value={fmtPct(metric.grossMarginTTM as number | undefined)} tone={numTone(metric.grossMarginTTM as number | undefined, 30)} />
            <StatTile label="영업 마진" value={fmtPct(metric.operatingMarginTTM as number | undefined)} tone={numTone(metric.operatingMarginTTM as number | undefined, 15)} />
            <StatTile label="순이익 마진" value={fmtPct(metric.netProfitMarginTTM as number | undefined)} tone={numTone(metric.netProfitMarginTTM as number | undefined, 10)} />
            <StatTile label="ROE" value={fmtPct(metric.roeTTM as number | undefined)} tone={numTone(metric.roeTTM as number | undefined, 15)} />
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">현금흐름 · 건전성</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              label="FCF TTM"
              value={fmtBig(metric.freeCashFlowTTM as number | undefined)}
              hint={metric.freeCashFlowPerShareTTM ? `주당 $${(metric.freeCashFlowPerShareTTM as number).toFixed(2)}` : undefined}
              tone={numTone(metric.freeCashFlowTTM as number | undefined, 0)}
            />
            <StatTile
              label="자사주 매입 TTM"
              value={fmtBig(metric.netBuybacksTTM as number | undefined)}
              tone={numTone(metric.netBuybacksTTM as number | undefined, 0)}
            />
            <StatTile
              label="부채/자본"
              value={metric.totalDebt_totalEquityAnnual !== undefined ? `${((metric.totalDebt_totalEquityAnnual as number) * 100).toFixed(0)}%` : "-"}
            />
            <StatTile
              label="유동비율"
              value={metric.currentRatioAnnual !== undefined ? `${(metric.currentRatioAnnual as number).toFixed(2)}x` : "-"}
              tone={metric.currentRatioAnnual !== undefined ? ((metric.currentRatioAnnual as number) >= 1.5 ? "up" : (metric.currentRatioAnnual as number) < 1 ? "down" : "neutral") : "neutral"}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function numTone(v: number | undefined, greatAbove?: number): "up" | "down" | "neutral" {
  if (v === undefined || !Number.isFinite(v)) return "neutral";
  if (greatAbove !== undefined) {
    if (v >= greatAbove) return "up";
    if (v <= 0) return "down";
    return "neutral";
  }
  return v >= 0 ? "up" : "down";
}

// ══════════════════════════════════════════════════════════
//  Financials trend card (Tier 1 #1) — 8 quarters bar chart
// ══════════════════════════════════════════════════════════

export function FinancialsTrendCard({ filings }: { filings: FinancialFiling[] | null }) {
  if (!filings || filings.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📊 재무제표 추세</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            SEC 재무제표 데이터가 없거나 Finnhub API가 미연결 상태입니다.
          </p>
        </CardContent>
      </Card>
    );
  }
  const rows = buildQuarterly(filings);
  if (rows.length === 0) {
    return null;
  }
  const maxRevenue = Math.max(...rows.map((r) => r.revenue ?? 0));
  const maxNi = Math.max(...rows.map((r) => Math.abs(r.netIncome ?? 0)));
  const maxFcf = Math.max(...rows.map((r) => Math.abs(r.fcf ?? 0)));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">📊 재무제표 추세 ({rows.length}분기)</CardTitle>
        <CardDescription className="text-xs">
          SEC 원본 (Finnhub /stock/financials-reported) · 매출 · 순이익 · FCF
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border/60 bg-muted/20 text-left text-[10px] text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">분기</th>
                <th className="px-2 py-1.5 text-right">매출</th>
                <th className="px-2 py-1.5 hidden sm:table-cell">매출 시각화</th>
                <th className="px-2 py-1.5 text-right">순이익</th>
                <th className="px-2 py-1.5 text-right">FCF</th>
                <th className="px-2 py-1.5 text-right hidden md:table-cell">순이익률</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const netMargin = r.revenue && r.netIncome ? (r.netIncome / r.revenue) * 100 : null;
                const revBar = r.revenue && maxRevenue > 0 ? (r.revenue / maxRevenue) * 100 : 0;
                return (
                  <tr key={r.period} className="border-b border-border/30">
                    <td className="px-2 py-1.5 font-mono">{r.period}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmtBig(r.revenue)}</td>
                    <td className="px-2 py-1.5 hidden sm:table-cell">
                      <div className="h-2 w-full max-w-[160px] overflow-hidden rounded-sm bg-muted/30">
                        <div className="h-full bg-primary/60" style={{ width: `${revBar}%` }} />
                      </div>
                    </td>
                    <td className={cn(
                      "px-2 py-1.5 text-right tabular-nums",
                      r.netIncome && r.netIncome >= 0 ? "text-success" : "text-destructive",
                    )}>{fmtBig(r.netIncome)}</td>
                    <td className={cn(
                      "px-2 py-1.5 text-right tabular-nums",
                      r.fcf && r.fcf >= 0 ? "text-success" : "text-destructive",
                    )}>{fmtBig(r.fcf)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums hidden md:table-cell text-muted-foreground">
                      {fmtPct(netMargin)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          FCF = Operating Cash Flow − Capex. 매출·순이익 매 분기 증가하고 순이익률이 안정적이면 견고한 성장.
        </p>
      </CardContent>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════
//  Advanced valuation card (Tier 2 #14 - PEG, EV/EBITDA, P/FCF)
// ══════════════════════════════════════════════════════════

export function AdvancedValuationCard({ metric }: { metric: FinnhubMetric | null }) {
  if (!metric) return null;
  // Compute PEG when we have PE + EPS growth
  const pe = (metric.peBasicExclExtraTTM as number | undefined) ?? undefined;
  const eps5y = (metric.epsGrowth5Y as number | undefined) ?? undefined;
  const peg = pe && eps5y && eps5y > 0 ? pe / eps5y : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">🧮 고급 밸류에이션</CardTitle>
        <CardDescription className="text-xs">
          PER 왜곡 보정 지표 (성장·현금흐름·기업가치 반영)
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="PEG"
          value={peg ? peg.toFixed(2) : "-"}
          hint={peg ? (peg < 1 ? "저평가 성장주" : peg < 2 ? "합리적" : "고평가") : "PE ÷ EPS 5Y"}
          tone={peg ? (peg < 1 ? "up" : peg > 2 ? "down" : "neutral") : "neutral"}
        />
        <StatTile
          label="EV/EBITDA"
          value={fmtMul(metric["enterpriseValueOverEBITDATTM" as keyof FinnhubMetric] as number | undefined)}
          hint="M&A 관점 밸류"
        />
        <StatTile
          label="P/FCF"
          value={fmtMul(metric.pfcfShareTTM as number | undefined)}
          hint="주가/주당FCF"
        />
        <StatTile
          label="P/S"
          value={fmtMul(metric.psTTM as number | undefined)}
        />
        <StatTile
          label="Payout Ratio"
          value={fmtPct(metric.payoutRatioAnnual !== undefined ? (metric.payoutRatioAnnual as number) * 100 : undefined)}
          hint="배당 지속성"
        />
        <StatTile
          label="배당 성장 5Y"
          value={fmtPct(metric.dividendGrowthRate5Y as number | undefined)}
          tone={numTone(metric.dividendGrowthRate5Y as number | undefined)}
        />
        <StatTile
          label="배당 수익률"
          value={fmtPct(metric.dividendYieldIndicatedAnnual as number | undefined)}
        />
        <StatTile
          label="Beta"
          value={metric.beta !== undefined ? (metric.beta as number).toFixed(2) : "-"}
          hint={metric.beta !== undefined ? ((metric.beta as number) > 1.2 ? "고변동" : (metric.beta as number) < 0.8 ? "저변동" : "시장 평균") : undefined}
        />
      </CardContent>
    </Card>
  );
}
