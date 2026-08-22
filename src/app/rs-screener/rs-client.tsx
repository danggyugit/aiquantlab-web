"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export type RsRow = {
  ticker: string;
  name: string;
  sector: string;
  capTier: string;
  ret1m: number;      // %
  ret3m: number;      // %
  ret12m: number;     // %  (short-term proxy when 12M cache is missing)
  rsRating: number;   // 1-99 percentile
};

export function RsClient({ rows, sectors }: { rows: RsRow[]; sectors: string[] }) {
  const [sector, setSector] = useState("All");
  const [capTier, setCapTier] = useState("All");
  const [minRs, setMinRs] = useState(70);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (sector !== "All" && r.sector !== sector) return false;
      if (capTier !== "All" && r.capTier !== capTier) return false;
      if (r.rsRating < minRs) return false;
      return true;
    });
  }, [rows, sector, capTier, minRs]);

  // Histogram bins (0-99 in 5-point buckets)
  const histogram = useMemo(() => {
    const buckets = Array.from({ length: 20 }, (_, i) => ({
      bucket: `${i * 5}-${i * 5 + 4}`,
      binStart: i * 5,
      count: 0,
    }));
    for (const r of rows) {
      if (sector !== "All" && r.sector !== sector) continue;
      if (capTier !== "All" && r.capTier !== capTier) continue;
      const idx = Math.min(19, Math.floor(r.rsRating / 5));
      buckets[idx].count += 1;
    }
    return buckets;
  }, [rows, sector, capTier]);

  const top90 = filtered.filter((r) => r.rsRating >= 90).sort((a, b) => b.rsRating - a.rsRating);
  const top80 = filtered.filter((r) => r.rsRating >= 80);
  const avgRs = filtered.length
    ? Math.round(filtered.reduce((a, b) => a + b.rsRating, 0) / filtered.length)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">섹터</Label>
              <Select value={sector} onValueChange={(v) => setSector((v as string) ?? "All")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">전체</SelectItem>
                  {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">시총</Label>
              <Select value={capTier} onValueChange={(v) => setCapTier((v as string) ?? "All")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">전체</SelectItem>
                  <SelectItem value="Large Cap">대형</SelectItem>
                  <SelectItem value="Mid Cap">중형</SelectItem>
                  <SelectItem value="Small Cap">소형</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>최소 RS Rating</span>
                <span className="font-mono font-semibold text-primary">{minRs}</span>
              </Label>
              <input
                type="range"
                min={0}
                max={99}
                step={1}
                value={minRs}
                onChange={(e) => setMinRs(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histogram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">RS 분포</CardTitle>
          <CardDescription className="text-xs">
            현재 필터의 유니버스 · 세로선 = 최소 RS 기준
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ResponsiveContainer>
              <BarChart data={histogram} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
                <XAxis dataKey="bucket" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} interval={1} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                {minRs > 0 && (
                  <ReferenceLine
                    x={`${Math.floor(minRs / 5) * 5}-${Math.floor(minRs / 5) * 5 + 4}`}
                    stroke="oklch(0.71 0.213 303.9)"
                    strokeDasharray="4 4"
                  />
                )}
                <Bar dataKey="count" fill="oklch(0.71 0.213 303.9)" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="스캔 종목" value={rows.length.toLocaleString()} />
        <Metric label="필터 결과" value={filtered.length.toLocaleString()} tone="primary" />
        <Metric label="RS 90+" value={top90.length.toLocaleString()} tone="success" />
        <Metric label="RS 80+" value={top80.length.toLocaleString()} tone="primary" />
        <Metric label="평균 RS" value={String(avgRs)} />
      </div>

      {/* RS 90+ chips */}
      {top90.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🔥 RS 90+ 종목</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {top90.slice(0, 40).map((r) => (
                <Link
                  key={r.ticker}
                  href={`/stock/${r.ticker}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-premium/30 bg-premium/10 px-2 py-1 font-mono text-xs font-semibold hover:bg-premium/20"
                >
                  <span className="text-premium">{r.ticker}</span>
                  <span className="text-muted-foreground">RS {r.rsRating}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result table */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">결과 ({filtered.length.toLocaleString()})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/20 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">회사</th>
                <th className="hidden px-3 py-2 sm:table-cell">섹터</th>
                <th className="px-3 py-2 text-right">RS</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">1M</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">3M</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">12M</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .sort((a, b) => b.rsRating - a.rsRating)
                .slice(0, 100)
                .map((r, i) => (
                  <tr key={r.ticker} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold">
                      <Link href={`/stock/${r.ticker}`} className="text-primary hover:underline">{r.ticker}</Link>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2">{r.name}</td>
                    <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{r.sector}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "tabular-nums",
                          r.rsRating >= 90 ? "bg-premium/20 text-premium"
                            : r.rsRating >= 80 ? "bg-success/20 text-success"
                            : r.rsRating >= 70 ? "bg-primary/15 text-primary"
                            : "bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {r.rsRating}
                      </Badge>
                    </td>
                    <td className={cn("hidden px-3 py-2 text-right tabular-nums md:table-cell", r.ret1m >= 0 ? "text-success" : "text-destructive")}>
                      {r.ret1m >= 0 ? "+" : ""}{r.ret1m.toFixed(1)}%
                    </td>
                    <td className={cn("hidden px-3 py-2 text-right tabular-nums md:table-cell", r.ret3m >= 0 ? "text-success" : "text-destructive")}>
                      {r.ret3m >= 0 ? "+" : ""}{r.ret3m.toFixed(1)}%
                    </td>
                    <td className={cn("hidden px-3 py-2 text-right tabular-nums md:table-cell", r.ret12m >= 0 ? "text-success" : "text-destructive")}>
                      {r.ret12m >= 0 ? "+" : ""}{r.ret12m.toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-100/90">
        <strong className="text-amber-400">데이터 한계:</strong> Streamlit의 정식 RS Rating은 12개월 가중 수익률 백분위입니다.
        현재는 캐시 제약으로 5일 모멘텀을 백분위 랭킹한 근사치입니다. 12M 히스토리 캐시 확장 후 정식 IBD RS로 대체 예정.
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: { label: string; value: string; tone?: "primary" | "success" }) {
  const color = tone === "primary" ? "text-primary" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-lg font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}
