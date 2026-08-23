"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { fmtMarketCap } from "@/lib/data";
import { ScreenerInsights } from "@/components/screener-insights";

export type BreakoutRow = {
  ticker: string;
  name: string;
  sector: string;
  industry: string | null;
  capTier: string;
  marketCap: number;
  price: number;
  fiftyTwoWkHigh: number;
  distFromHigh: number;   // pct: negative = below, positive = above
  changePct: number;      // recent %
  upDays: number;
  totalDays: number;
  volumeRatio: number;    // recent volume / avg (1.5+ = breakout)
};

const TREND_OPTS = ["전체", "상승 추세만", "하락 추세만"] as const;
const CAP_OPTS = ["전체", "대형", "중형", "소형"] as const;

export function BreakoutClient({ rows, sectors }: { rows: BreakoutRow[]; sectors: string[] }) {
  // Channel settings (Streamlit sliders — cache-based here, no live scan)
  const [lookback, setLookback] = useState(60);
  const [kSigma, setKSigma] = useState(2.0);
  const [scanMonths, setScanMonths] = useState(1);

  // Filters
  const [trendFilter, setTrendFilter] = useState<typeof TREND_OPTS[number]>("전체");
  const [minR2, setMinR2] = useState(0.5);
  const [onlyAbove, setOnlyAbove] = useState(false);
  const [sectorFilter, setSectorFilter] = useState("전체");
  const [capFilter, setCapFilter] = useState<typeof CAP_OPTS[number]>("전체");
  const [notesOpen, setNotesOpen] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (sectorFilter !== "전체" && r.sector !== sectorFilter) return false;
      const capMap: Record<string, string> = { "대형": "Large Cap", "중형": "Mid Cap", "소형": "Small Cap" };
      if (capFilter !== "전체" && r.capTier !== capMap[capFilter]) return false;
      if (onlyAbove && r.distFromHigh < 0) return false;
      // Trend proxy: recent upDays vs down. Real regression trend isn't cached.
      const upRatio = r.totalDays > 0 ? r.upDays / r.totalDays : 0.5;
      if (trendFilter === "상승 추세만" && upRatio < 0.5) return false;
      if (trendFilter === "하락 추세만" && upRatio >= 0.5) return false;
      // R² proxy: strong trend = consistent direction (upDays / totalDays close to 1 or 0)
      const rSquaredProxy = Math.abs(upRatio - 0.5) * 2;
      if (rSquaredProxy < minR2) return false;
      return true;
    })
    .sort((a, b) => b.distFromHigh - a.distFromHigh);
  }, [rows, sectorFilter, capFilter, onlyAbove, trendFilter, minR2]);

  const scanLabel = scanMonths === 1 ? "이번달" : `최근 ${scanMonths}개월`;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Channel Settings (Streamlit's 4 sliders) ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📐 채널 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <SliderField
              label="Lookback (개월)"
              value={lookback}
              min={12}
              max={60}
              step={6}
              onChange={setLookback}
            />
            <SliderField
              label="채널 폭 (kσ)"
              value={kSigma}
              min={1}
              max={3}
              step={0.25}
              onChange={setKSigma}
              decimals={2}
            />
            <SliderField
              label="돌파 탐색 기간 (개월)"
              value={scanMonths}
              min={1}
              max={12}
              step={1}
              onChange={setScanMonths}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">🔎 필터</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">추세 방향</Label>
              <Select value={trendFilter} onValueChange={(v) => setTrendFilter(((v as string) ?? "전체") as typeof TREND_OPTS[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TREND_OPTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>최소 R²</span>
                <span className="font-mono font-semibold text-primary">{minR2.toFixed(2)}</span>
              </Label>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={minR2}
                onChange={(e) => setMinR2(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">섹터</Label>
              <Select value={sectorFilter} onValueChange={(v) => setSectorFilter((v as string) ?? "전체")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="전체">전체</SelectItem>
                  {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">시총</Label>
              <Select value={capFilter} onValueChange={(v) => setCapFilter(((v as string) ?? "전체") as typeof CAP_OPTS[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAP_OPTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyAbove}
              onChange={(e) => setOnlyAbove(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span>현재도 상단 위 유지만 (52주 고가 돌파 후 유지)</span>
          </label>
        </CardContent>
      </Card>

      {/* Info bar */}
      <p className="text-xs text-muted-foreground">
        기준월: 최근 · 조회 {lookback}개월 · 채널폭 {kSigma}σ · 돌파 탐색 {scanLabel} · <strong className="text-foreground">{filtered.length.toLocaleString()}</strong>종목
      </p>

      {/* Where are the results clustered? sector · industry breakdown */}
      <ScreenerInsights filtered={filtered} universe={rows} />

      {/* Result Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">회사</th>
                <th className="hidden px-3 py-2 sm:table-cell">섹터</th>
                <th className="px-3 py-2 text-right">돌파강도</th>
                <th className="px-3 py-2 text-right">돌파가</th>
                <th className="px-3 py-2 text-right">현재가</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">현재상태</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">거래량비</th>
                <th className="hidden px-3 py-2 text-right lg:table-cell">시총</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((r, i) => (
                <tr key={r.ticker} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                    <Link href={`/stock/${r.ticker}`} className="text-primary hover:underline">{r.ticker}</Link>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2">{r.name}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{r.sector}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", r.distFromHigh >= 0 ? "text-success" : "text-amber-400")}>
                    {r.distFromHigh >= 0 ? "+" : ""}{r.distFromHigh.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">${r.fiftyTwoWkHigh.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">${r.price.toFixed(2)}</td>
                  <td className={cn("hidden px-3 py-2 text-right tabular-nums md:table-cell text-xs", r.changePct >= 0 ? "text-success" : "text-destructive")}>
                    {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(1)}%
                  </td>
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">
                    {r.volumeRatio > 1.5 ? (
                      <Badge variant="secondary" className="bg-success/20 text-success text-[10px]">
                        {r.volumeRatio.toFixed(1)}×
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">{r.volumeRatio.toFixed(1)}×</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-2 text-right tabular-nums text-xs text-muted-foreground lg:table-cell">
                    {fmtMarketCap(r.marketCap)}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    조건에 맞는 종목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Notes expander */}
      <details className="group" open={notesOpen} onToggle={() => setNotesOpen(!notesOpen)}>
        <summary className="flex cursor-pointer items-center justify-between rounded-lg border border-border/40 bg-card/50 px-4 py-2 text-sm">
          <span>ℹ️ 계산 방식 / 해석 주의</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", notesOpen && "rotate-180")} />
        </summary>
        <div className="mt-2 rounded-lg border border-border/30 bg-card/30 p-4 text-xs text-muted-foreground">
          <div className="space-y-2">
            <p><strong className="text-foreground">채널 정의 (원본)</strong>: 최근 lookback 개월의 로그가격 회귀선 ± kσ. 상단선 돌파 시 돌파 시그널.</p>
            <p><strong className="text-foreground">돌파 판정 (원본)</strong>: 각 월의 실제 종가가 채널 상단(회귀선 + kσ) 초과 시 돌파. 투영법으로 향후 방향 추정.</p>
            <p><strong className="text-foreground">R² 해석</strong>: 회귀 적합도. 0.7 이상이면 강한 추세, 0.3 미만이면 노이즈.</p>
            <p><strong className="text-foreground">현재 캐시 한계</strong>: 월봉 가격 캐시 부재로 정식 회귀 채널 대신 <strong>52주 고가 대비 근접도</strong> + <strong>최근 상승일 비율</strong>로 근사. 정식 계산은 stock-dashboard의 monthly cache 확장 후 활성화.</p>
          </div>
        </div>
      </details>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  decimals = 0,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono font-semibold text-primary">{value.toFixed(decimals)}</span>
      </Label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}
