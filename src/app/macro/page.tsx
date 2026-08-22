import {
  computeNetLiquidity,
  computeYoY,
  fmtMacro,
  getAllMacroSeries,
  getMarketSnapshot,
  latestPoint,
} from "@/lib/data";
import { MarketBadge } from "@/components/market-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  InflationBarChart,
  MacroAreaChart,
  MoneySupplyChart,
  NetLiquidityChart,
  TreasuryChart,
} from "./macro-charts";
import { Interpretation, inflationStatus, statusFromThreshold } from "./interpretation";

export const metadata = { title: "매크로 · AI Quant Lab" };
export const revalidate = 900;

/**
 * Mirrors Streamlit 11_Macro.py (485 lines) exactly — 4 sections in order:
 *   1. Liquidity: 5 badges + Net Liq overlay + 2x2 (RRP/TGA/Reserves/HY) +
 *      M1/M2 + Fed Balance Sheet
 *   2. Interest Rates: Fed Funds + Treasury Yields (2-col)
 *   3. Inflation: CPI YoY + Core PCE YoY (2-col, threshold-colored bars)
 *   4. Dollar & Commodities: DXY + Gold + WTI (3-col)
 *
 * Data via streamlit_app/data/cache/macro/*.json (FRED CSV cached daily
 * by streamlit_app/scripts/cache_macro_data.py). No live API calls.
 */

export default async function MacroPage() {
  const [macro, snapshot] = await Promise.all([getAllMacroSeries(), getMarketSnapshot()]);

  // ── Computed series ────────────────────────────────────────
  const netLiq = computeNetLiquidity(macro.walcl, macro.rrp, macro.tga);
  const cpiYoY = computeYoY(macro.cpi);
  const pceYoY = computeYoY(macro.core_pce);

  // Latest values for badges (Streamlit shows 4W change with color)
  const b_netliq = latestPoint(netLiq);
  const b_rrp = latestPoint(macro.rrp);
  const b_tga = latestPoint(macro.tga);
  const b_res = latestPoint(macro.reserves);
  const b_hy = latestPoint(macro.hy_oas);
  const b_fed = latestPoint(macro.fed_funds);
  const b_walcl = latestPoint(macro.walcl);
  const b_dgs10 = latestPoint(macro.dgs10);
  const b_dgs2 = latestPoint(macro.dgs2);
  const spread = b_dgs10 && b_dgs2 ? b_dgs10.value - b_dgs2.value : null;
  const b_cpi = latestPoint(cpiYoY);
  const b_pce = latestPoint(pceYoY);
  const b_dxy = latestPoint(macro.dxy);
  const b_wti = latestPoint(macro.wti);

  // SPY series for Net Liquidity overlay — reuse from VIX history date range
  // (heatmap cache has recent SPY close via breadth). For a proper overlay,
  // we'd need SPY history. For now, single-line net-liq is still informative.
  const spySeries = [{ date: b_netliq?.date ?? "", value: snapshot.breadth.spy_close }];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">매크로</h1>
          <MarketBadge />
        </div>
        <p className="text-sm text-muted-foreground">
          유동성 · 금리 · 인플레이션 · 달러/상품 · Streamlit 11_Macro.py 미러링
        </p>
      </header>

      {/* ═══ 1. 유동성 (Liquidity) ═══ */}
      <Section title="유동성 (Liquidity)">
        {/* 5 badges */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Badge label="Net Liquidity" value={fmtMacro(b_netliq?.value, "$")} tone="primary" />
          <Badge label="RRP" value={b_rrp ? `$${(b_rrp.value / 1e3).toFixed(2)}T` : "-"} tone="neutral" />
          <Badge label="TGA" value={b_tga ? `$${(b_tga.value / 1e6).toFixed(2)}T` : "-"} tone="neutral" />
          <Badge label="Reserves" value={b_res ? `$${(b_res.value / 1e6).toFixed(2)}T` : "-"} tone="neutral" />
          <Badge label="HY Spread" value={b_hy ? `${b_hy.value.toFixed(2)}%` : "-"} tone={b_hy && b_hy.value > 5 ? "danger" : "success"} />
        </div>

        {/* Net Liquidity overlay chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">⭐ Net Liquidity vs S&amp;P 500</CardTitle>
            <p className="text-xs text-muted-foreground">
              순유동성(연준자산 − 역레포 − 재무부계정) — 주가와 동행성 확인
            </p>
          </CardHeader>
          <CardContent>
            <NetLiquidityChart netLiq={netLiq} spy={spySeries} />
            <p className="mt-2 text-[10px] text-muted-foreground">
              SPY 오버레이는 단일 시점만 표시 · SPY 시계열 캐시 확장 후 완성
            </p>
            <Interpretation
              direction="up_bullish"
              status="neutral"
              note="Net Liquidity가 늘면 시장에 유동성이 공급되어 주가와 동행하는 경향. 방향성 반전이 나오면 조기 경보."
            />
          </CardContent>
        </Card>

        {/* 2x2 grid: RRP, TGA, Reserves, HY */}
        <div className="grid gap-3 lg:grid-cols-2">
          <MiniChartCard
            title="역레포 (RRP)"
            subtitle="연준에 잠긴 유동성 ($B)"
            data={macro.rrp?.data ?? []}
            color="oklch(0.71 0.213 303.9)"
            format="usd_b"
            interpretation={
              <Interpretation
                direction="down_bullish"
                status="neutral"
                note="RRP 잔액이 줄면 그만큼 시장에 유동성이 풀림. 감소 추세 = 우호적, 급증 = 유동성 흡수 신호."
              />
            }
          />
          <MiniChartCard
            title="재무부 계정 (TGA)"
            subtitle="재무부 보유 현금 ($M)"
            data={macro.tga?.data ?? []}
            color="oklch(0.777 0.152 163.223)"
            format="usd_t_mil"
            interpretation={
              <Interpretation
                direction="down_bullish"
                status="neutral"
                note="TGA가 줄어드는 것은 정부가 돈을 시중에 풀고 있다는 의미 → 유동성 공급. 급증하면 재정 흡수."
              />
            }
          />
          <MiniChartCard
            title="은행 지준금 (Reserves)"
            subtitle="은행 시스템의 실탄"
            data={macro.reserves?.data ?? []}
            color="oklch(0.623 0.214 259.815)"
            format="usd_t_mil"
            interpretation={
              <Interpretation
                direction="up_bullish"
                status="neutral"
                note="은행이 보유한 여유 자금. 늘어나면 대출·투자 여력↑ → 시장 우호적. QT 국면에는 감소 추세."
              />
            }
          />
          <MiniChartCard
            title="하이일드 스프레드 (HY OAS)"
            subtitle="신용시장 스트레스 · 5% 초과 시 경계"
            data={macro.hy_oas?.data ?? []}
            color="oklch(0.828 0.189 84.429)"
            format="pct1"
            refValueY={5}
            interpretation={
              <Interpretation
                direction="down_bullish"
                status={statusFromThreshold(b_hy?.value, 4, 6, "lower-better")}
                note="회사채 스프레드가 넓어지면 신용시장 스트레스↑ = 위험자산 부담. < 4% 안정 · > 6% 경계 · > 8% 위기."
              />
            }
          />
        </div>

        <hr className="border-border/40" />

        {/* M1/M2 + Fed Balance Sheet (2-col) */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">M1 / M2 Money Supply</CardTitle>
              <p className="text-xs text-muted-foreground">
                M2 최신 {b_dgs2 ? "" : ""}
                {macro.m2 && latestPoint(macro.m2) ? `$${(latestPoint(macro.m2)!.value / 1e3).toFixed(2)}T` : "-"}
              </p>
            </CardHeader>
            <CardContent>
              <MoneySupplyChart m1={macro.m1?.data ?? []} m2={macro.m2?.data ?? []} />
              <Interpretation
                direction="up_bullish"
                status="neutral"
                note="통화량이 늘면 자산가격 상승 압력. 급격한 팽창은 인플레 자극, 급격한 수축은 침체 신호."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fed Balance Sheet (WALCL)</CardTitle>
              <p className="text-xs text-muted-foreground">
                총자산 {b_walcl ? `$${(b_walcl.value / 1e6).toFixed(2)}T` : "-"}
              </p>
            </CardHeader>
            <CardContent>
              <MacroAreaChart
                data={macro.walcl?.data ?? []}
                color="oklch(0.623 0.214 259.815)"
                height={280}
                format="usd_t_mil"
              />
              <Interpretation
                direction="up_bullish"
                status="neutral"
                note="Fed 자산 증가 = QE (유동성 공급, 시장 우호적) · 감소 = QT (긴축, 부담). 2022년부터 QT 진행."
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ═══ 2. 금리 (Interest Rates) ═══ */}
      <Section title="금리 (Interest Rates)">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Federal Funds Rate</CardTitle>
              <p className="text-xs text-muted-foreground">
                현재 {b_fed ? `${b_fed.value.toFixed(2)}%` : "-"}
              </p>
            </CardHeader>
            <CardContent>
              <MacroAreaChart
                data={macro.fed_funds?.data ?? []}
                color="oklch(0.71 0.213 303.9)"
                height={300}
                format="pct2"
              />
              <Interpretation
                direction="down_bullish"
                status={statusFromThreshold(b_fed?.value, 3, 5, "lower-better")}
                note="Fed 정책금리. 인하 사이클 = 성장주·리스크자산 우호적, 인상 사이클 = 부담. 4% 이하 = 완화, 5% 이상 = 긴축."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Treasury Yields &amp; Spread (10Y − 2Y)</CardTitle>
              <p className="text-xs text-muted-foreground">
                {b_dgs10 && b_dgs2 && spread !== null
                  ? `10Y ${b_dgs10.value.toFixed(2)}% · 2Y ${b_dgs2.value.toFixed(2)}% · Spread ${spread.toFixed(2)}%`
                  : "-"}
              </p>
            </CardHeader>
            <CardContent>
              <TreasuryChart dgs10={macro.dgs10?.data ?? []} dgs2={macro.dgs2?.data ?? []} />
              {b_dgs10 && b_dgs2 && spread !== null && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MiniMetric label="10Y" value={`${b_dgs10.value.toFixed(2)}%`} />
                  <MiniMetric label="2Y" value={`${b_dgs2.value.toFixed(2)}%`} />
                  <MiniMetric
                    label="Spread"
                    value={`${spread.toFixed(2)}%`}
                    tone={spread < 0 ? "danger" : "neutral"}
                  />
                </div>
              )}
              <Interpretation
                direction="neutral"
                status={spread !== null && spread >= 0 ? "bullish" : "bearish"}
                note="10Y−2Y 스프레드가 양수 = 정상 곡선, 음수(역전) = 침체 선행 신호 (역사적으로 12~18개월 후 침체)."
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ═══ 3. 인플레이션 (Inflation) ═══ */}
      <Section title="인플레이션 (Inflation)">
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">CPI (YoY %)</CardTitle>
              <p className="text-xs text-muted-foreground">
                최신 {b_cpi ? `${b_cpi.value.toFixed(2)}%` : "-"} · Fed 목표 2%
              </p>
            </CardHeader>
            <CardContent>
              <InflationBarChart data={cpiYoY} />
              <Interpretation
                direction="down_bullish"
                status={inflationStatus(b_cpi?.value)}
                note="Fed 목표 2% 근처가 이상적. 4% 이상 = 긴축 지속 압박, 1% 미만 = 디플레이션 우려."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Core PCE (YoY %) — Fed 선호 지표</CardTitle>
              <p className="text-xs text-muted-foreground">
                최신 {b_pce ? `${b_pce.value.toFixed(2)}%` : "-"} · Fed 목표 2%
              </p>
            </CardHeader>
            <CardContent>
              <InflationBarChart data={pceYoY} />
              <Interpretation
                direction="down_bullish"
                status={inflationStatus(b_pce?.value)}
                note="Fed가 정책 결정에 실제 참고하는 인플레 지표. Core PCE < 2.5% 진입 = 금리 인하 가능성↑."
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ═══ 4. 달러 & 상품 (Dollar & Commodities) ═══ */}
      <Section title="달러 & 상품 (Dollar & Commodities)">
        <div className="grid gap-3 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">DXY (Dollar Index)</CardTitle>
              <p className="text-xs text-muted-foreground">
                최신 {b_dxy ? b_dxy.value.toFixed(2) : "-"}
              </p>
            </CardHeader>
            <CardContent>
              <MacroAreaChart
                data={macro.dxy?.data ?? []}
                color="oklch(0.623 0.214 259.815)"
                height={260}
                format="raw"
              />
              <Interpretation
                direction="down_bullish"
                status={statusFromThreshold(b_dxy?.value, 100, 106, "lower-better")}
                note="달러 약세 = 미국 수출·다국적 기업 실적↑ · 신흥국·상품 우호적. > 106 = 강달러 부담."
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Gold</CardTitle>
              <p className="text-xs text-muted-foreground">
                최신 ${snapshot.commodities.gold.current.toLocaleString()} · 6M 평균 $
                {snapshot.commodities.gold.avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </CardHeader>
            <CardContent className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
              FRED 시리즈 마이그레이션 대기 · 요약값은 market_snapshot에서
            </CardContent>
            <div className="px-6 pb-4">
              <Interpretation
                direction="neutral"
                status="neutral"
                note="금값 상승 = 인플레·리스크 회피 신호 (안전자산 선호). 방향보다 배경(달러·금리·지정학) 확인 필요."
              />
            </div>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">WTI Crude Oil</CardTitle>
              <p className="text-xs text-muted-foreground">
                최신 ${b_wti ? b_wti.value.toFixed(2) : "-"} / bbl
              </p>
            </CardHeader>
            <CardContent>
              <MacroAreaChart
                data={macro.wti?.data ?? []}
                color="oklch(0.828 0.189 84.429)"
                height={260}
                format="usd_int"
              />
              <Interpretation
                direction="neutral"
                status={statusFromThreshold(b_wti?.value, 70, 90, "lower-better")}
                note="적정 가격 (60-80) = 경기 활동 반영 · > $90 = 인플레 재점화 위험 · < $50 = 수요 침체 신호."
              />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}

// ─────────────── Sub-components ───────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Badge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "success" | "danger" | "neutral";
}) {
  const color =
    tone === "primary" ? "border-primary/40 bg-primary/5 text-primary"
    : tone === "success" ? "border-success/40 bg-success/5 text-success"
    : tone === "danger" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-border/40 bg-card/40 text-foreground";
  return (
    <div className={cn("rounded-lg border px-3 py-2", color)}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-base font-bold tabular-nums">{value}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: { label: string; value: string; tone?: "danger" | "neutral" }) {
  const color = tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-semibold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function MiniChartCard({
  title,
  subtitle,
  data,
  color,
  format,
  refValueY,
  interpretation,
}: {
  title: string;
  subtitle: string;
  data: import("@/lib/data").MacroPoint[];
  color: string;
  format?: import("./macro-charts").ChartFormat;
  refValueY?: number;
  interpretation?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <MacroAreaChart
          data={data}
          color={color}
          height={220}
          format={format}
          refValueY={refValueY}
        />
        {interpretation}
      </CardContent>
    </Card>
  );
}
