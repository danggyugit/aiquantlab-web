"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// Mirrors streamlit_app/app_pages/8_Screener.py exactly.

export type ScreenerRow = {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  cap_tier: string;
  price: number | null;
  market_cap: number;
  pe_ratio: number | null;
  pb_ratio: number | null;
  ps_ratio: number | null;
  eps: number | null;
  roe: number | null;
  dividend_yield: number | null;
  beta: number | null;
  debt_to_equity: number | null;
  avg_volume: number | null;
};

// ── Streamlit selectbox option lists (exact) ──────────────────
const PE_OPTS = ["Any", "Under 5", "Under 10", "Under 15", "Under 20", "Under 30", "Under 50", "Over 50"];
const PB_OPTS = ["Any", "Under 1", "Under 2", "Under 3", "Under 5", "Over 5"];
const PS_OPTS = ["Any", "Under 1", "Under 2", "Under 5", "Under 10", "Over 10"];
const DIV_OPTS = ["Any", "Over 0%", "Over 1%", "Over 2%", "Over 3%", "Over 5%", "Over 7%"];
const ROE_OPTS = ["Any", "Positive (>0%)", "Over 5%", "Over 10%", "Over 15%", "Over 20%", "Over 30%"];
const DE_OPTS = ["Any", "Under 0.5", "Under 1", "Under 2", "Over 2"];
const EPS_OPTS = ["Any", "Positive", "Negative", "Over 1", "Over 5", "Over 10"];
const BETA_OPTS = ["Any", "Under 0.5", "Under 1", "1 to 1.5", "1.5 to 2", "Over 2"];
const CAP_OPTS = ["Any", "Mega (>200B)", "Large (10B-200B)", "Mid (2B-10B)", "Small (300M-2B)", "Micro (<300M)"];
const VOL_OPTS = ["Any", "Over 100K", "Over 500K", "Over 1M", "Over 5M"];

const SORT_OPTS = [
  { key: "market_cap", label: "Market Cap" },
  { key: "ticker", label: "Ticker" },
  { key: "pe_ratio", label: "P/E" },
  { key: "dividend_yield", label: "Dividend Yield" },
  { key: "beta", label: "Beta" },
  { key: "roe", label: "ROE" },
  { key: "eps", label: "EPS" },
] as const;

type Filters = {
  sector: string;
  industry: string;
  search: string;
  pe: string;
  pb: string;
  ps: string;
  div: string;
  roe: string;
  de: string;
  eps: string;
  beta: string;
  cap: string;
  vol: string;
};

const INITIAL: Filters = {
  sector: "All",
  industry: "All",
  search: "",
  pe: "Any",
  pb: "Any",
  ps: "Any",
  div: "Any",
  roe: "Any",
  de: "Any",
  eps: "Any",
  beta: "Any",
  cap: "Any",
  vol: "Any",
};

const PAGE_SIZE = 50;

export function ScreenerClient({ rows, sectors }: { rows: ScreenerRow[]; sectors: string[] }) {
  const [pending, setPending] = useState<Filters>(INITIAL);   // form state
  const [applied, setApplied] = useState<Filters>(INITIAL);   // last submitted
  const [sortBy, setSortBy] = useState<typeof SORT_OPTS[number]["key"]>("market_cap");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);

  const industries = useMemo(() => {
    if (pending.sector === "All") return ["All"];
    const set = new Set<string>();
    for (const r of rows) if (r.sector === pending.sector) set.add(r.industry);
    return ["All", ...Array.from(set).filter(Boolean).sort()];
  }, [rows, pending.sector]);

  const filtered = useMemo(() => applyFilters(rows, applied), [rows, applied]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortBy as keyof ScreenerRow];
      const bv = b[sortBy as keyof ScreenerRow];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return sortDesc ? bv - av : av - bv;
      const cmp = String(av).localeCompare(String(bv));
      return sortDesc ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortBy, sortDesc]);

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  // Sector distribution for bar chart at bottom
  const sectorDist = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) map.set(r.sector, (map.get(r.sector) ?? 0) + 1);
    return Array.from(map.entries())
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  function applyForm() {
    setApplied(pending);
    setPage(0);
  }

  function reset() {
    setPending(INITIAL);
    setApplied(INITIAL);
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ═══ Filters (Streamlit's st.form) ═══ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">필터</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Row 1: Sector, Industry, Search */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sector">
              <Select
                value={pending.sector}
                onValueChange={(v) => setPending({ ...pending, sector: (v as string) ?? "All", industry: "All" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Industry">
              <Select
                value={pending.industry}
                onValueChange={(v) => setPending({ ...pending, industry: (v as string) ?? "All" })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Search (Ticker/Name)">
              <Input
                placeholder="AAPL, Apple..."
                value={pending.search}
                onChange={(e) => setPending({ ...pending, search: e.target.value })}
              />
            </Field>
          </div>

          {/* Row 2 — Valuation */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Valuation
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <PickField label="P/E" value={pending.pe} options={PE_OPTS} onChange={(v) => setPending({ ...pending, pe: v })} />
              <PickField label="P/B" value={pending.pb} options={PB_OPTS} onChange={(v) => setPending({ ...pending, pb: v })} />
              <PickField label="P/S" value={pending.ps} options={PS_OPTS} onChange={(v) => setPending({ ...pending, ps: v })} />
              <PickField label="Dividend Yield" value={pending.div} options={DIV_OPTS} onChange={(v) => setPending({ ...pending, div: v })} />
            </div>
          </div>

          {/* Row 3 — Fundamentals */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Fundamentals
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <PickField label="ROE" value={pending.roe} options={ROE_OPTS} onChange={(v) => setPending({ ...pending, roe: v })} />
              <PickField label="Debt/Equity" value={pending.de} options={DE_OPTS} onChange={(v) => setPending({ ...pending, de: v })} />
              <PickField label="EPS" value={pending.eps} options={EPS_OPTS} onChange={(v) => setPending({ ...pending, eps: v })} />
              <PickField label="Beta" value={pending.beta} options={BETA_OPTS} onChange={(v) => setPending({ ...pending, beta: v })} />
            </div>
          </div>

          {/* Row 4 — Market Cap + Volume */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Market Cap / Volume
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PickField label="Market Cap" value={pending.cap} options={CAP_OPTS} onChange={(v) => setPending({ ...pending, cap: v })} />
              <PickField label="Avg Volume" value={pending.vol} options={VOL_OPTS} onChange={(v) => setPending({ ...pending, vol: v })} />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-2 border-t border-border/30 pt-3">
            <Button size="sm" onClick={applyForm}>🔍 Apply Filters</Button>
            <Button size="sm" variant="outline" onClick={reset}>↺ Reset</Button>
            <div className="ml-auto flex items-center text-xs text-muted-foreground">
              Found <Badge variant="secondary" className="mx-1.5 text-[11px]">{filtered.length.toLocaleString()}</Badge> stocks
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Sort & Order ═══ */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sort by">
          <Select value={sortBy} onValueChange={(v) => setSortBy((v as typeof SORT_OPTS[number]["key"]) ?? "market_cap")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Order">
          <Select value={sortDesc ? "desc" : "asc"} onValueChange={(v) => setSortDesc(v === "desc")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* ═══ Results Table ═══ */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Name</th>
                <th className="hidden px-3 py-2 sm:table-cell">Sector</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Market Cap</th>
                <th className="px-3 py-2 text-right">P/E</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">P/B</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">Div%</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">ROE</th>
                <th className="hidden px-3 py-2 text-right md:table-cell">Beta</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.ticker} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                    <Link href={`/stock/${r.ticker}`} className="text-primary hover:underline">{r.ticker}</Link>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2">{r.name}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{r.sector}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.price ? `$${r.price.toFixed(2)}` : "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtCap(r.market_cap)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.pe_ratio && r.pe_ratio > 0 ? r.pe_ratio.toFixed(1) : "-"}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{r.pb_ratio ? r.pb_ratio.toFixed(2) : "-"}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{r.dividend_yield && r.dividend_yield > 0 ? `${r.dividend_yield.toFixed(2)}%` : "-"}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{r.roe !== null ? `${(r.roe * 100).toFixed(1)}%` : "-"}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums md:table-cell">{r.beta !== null ? r.beta.toFixed(2) : "-"}</td>
                </tr>
              ))}
              {paged.length === 0 && (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
          <span className="text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>다음</Button>
        </div>
      )}

      {/* Sector Distribution */}
      {sectorDist.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sector Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer>
                <BarChart data={sectorDist} margin={{ top: 8, right: 12, bottom: 60, left: -8 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" opacity={0.4} />
                  <XAxis dataKey="sector" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count">
                    {sectorDist.map((_, i) => (
                      <Cell key={i} fill={`oklch(0.623 0.214 ${259 + i * 20})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────── Filter application ───────────────

function applyFilters(rows: ScreenerRow[], f: Filters): ScreenerRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.sector !== "All" && r.sector !== f.sector) return false;
    if (f.industry !== "All" && r.industry !== f.industry) return false;
    if (q && !r.ticker.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;

    if (!passesNumberOpt(r.pe_ratio, f.pe, true)) return false;
    if (!passesNumberOpt(r.pb_ratio, f.pb)) return false;
    if (!passesNumberOpt(r.ps_ratio, f.ps)) return false;
    if (!passesDivOpt(r.dividend_yield, f.div)) return false;
    if (!passesRoeOpt(r.roe, f.roe)) return false;
    if (!passesRangeOpt(r.debt_to_equity, f.de)) return false;
    if (!passesEpsOpt(r.eps, f.eps)) return false;
    if (!passesRangeOpt(r.beta, f.beta)) return false;
    if (!passesCapOpt(r.market_cap, f.cap)) return false;
    if (!passesVolOpt(r.avg_volume, f.vol)) return false;
    return true;
  });
}

/** Under X / Over X. peExcludeZero: for P/E, reject values <= 0. */
function passesNumberOpt(v: number | null, opt: string, peExcludeZero = false): boolean {
  if (opt === "Any") return true;
  if (v === null) return false;
  if (peExcludeZero && v <= 0) return false;
  if (opt.startsWith("Under ")) {
    const th = parseFloat(opt.slice(6));
    return v < th;
  }
  if (opt.startsWith("Over ")) {
    const th = parseFloat(opt.slice(5));
    return v > th;
  }
  return true;
}

function passesRangeOpt(v: number | null, opt: string): boolean {
  if (opt === "Any") return true;
  if (v === null) return false;
  if (opt.startsWith("Under ")) return v < parseFloat(opt.slice(6));
  if (opt.startsWith("Over ")) return v > parseFloat(opt.slice(5));
  // Handle "1 to 1.5", "1.5 to 2"
  const m = opt.match(/^([\d.]+)\s*to\s*([\d.]+)$/);
  if (m) return v >= parseFloat(m[1]) && v <= parseFloat(m[2]);
  return true;
}

function passesDivOpt(v: number | null, opt: string): boolean {
  if (opt === "Any") return true;
  if (v === null || v <= 0) return opt === "Over 0%";  // 0% match only "Over 0%"
  const m = opt.match(/Over (\d+)%/);
  if (!m) return true;
  return v > parseFloat(m[1]);
}

function passesRoeOpt(v: number | null, opt: string): boolean {
  if (opt === "Any") return true;
  if (v === null) return false;
  const pct = v * 100;
  if (opt === "Positive (>0%)") return pct > 0;
  const m = opt.match(/Over (\d+)%/);
  if (!m) return true;
  return pct > parseFloat(m[1]);
}

function passesEpsOpt(v: number | null, opt: string): boolean {
  if (opt === "Any") return true;
  if (v === null) return false;
  if (opt === "Positive") return v > 0;
  if (opt === "Negative") return v < 0;
  if (opt.startsWith("Over ")) return v > parseFloat(opt.slice(5));
  return true;
}

function passesCapOpt(v: number, opt: string): boolean {
  if (opt === "Any") return true;
  // v is in dollars
  const B = 1e9;
  switch (opt) {
    case "Mega (>200B)": return v > 200 * B;
    case "Large (10B-200B)": return v >= 10 * B && v <= 200 * B;
    case "Mid (2B-10B)": return v >= 2 * B && v < 10 * B;
    case "Small (300M-2B)": return v >= 300e6 && v < 2 * B;
    case "Micro (<300M)": return v < 300e6;
    default: return true;
  }
}

function passesVolOpt(v: number | null, opt: string): boolean {
  if (opt === "Any") return true;
  if (v === null) return false;
  const map: Record<string, number> = { "Over 100K": 1e5, "Over 500K": 5e5, "Over 1M": 1e6, "Over 5M": 5e6 };
  return v > (map[opt] ?? 0);
}

function fmtCap(v: number): string {
  if (!v) return "-";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

// ─────────────── Field helpers ───────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PickField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange((v as string) ?? "Any")}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

