"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type ScreenerRow = {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  cap_tier: string;
  pe_ratio: number | null;
  pb_ratio: number | null;
  roe: number | null;
  dividend_yield: number | null;
  beta: number | null;
  debt_to_equity: number | null;
};

type SortKey = "ticker" | "name" | "sector" | "pe_ratio" | "pb_ratio" | "roe" | "dividend_yield" | "beta";
type SortDir = "asc" | "desc";

const NUMERIC_KEYS: SortKey[] = ["pe_ratio", "pb_ratio", "roe", "dividend_yield", "beta"];

const PAGE_SIZE = 50;

type Filters = {
  q: string;
  sector: string;
  peMax: string;
  pbMax: string;
  roeMin: string;
  divMin: string;
};

const initialFilters: Filters = {
  q: "",
  sector: "all",
  peMax: "",
  pbMax: "",
  roeMin: "",
  divMin: "",
};

export function ScreenerClient({ rows, sectors }: { rows: ScreenerRow[]; sectors: string[] }) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    const peMax = filters.peMax ? parseFloat(filters.peMax) : null;
    const pbMax = filters.pbMax ? parseFloat(filters.pbMax) : null;
    // roe/div come in percentage (e.g., 15 = 15%). Cache stores roe as fraction (0.15), div as percentage (0.68).
    const roeMinFrac = filters.roeMin ? parseFloat(filters.roeMin) / 100 : null;
    const divMinPct = filters.divMin ? parseFloat(filters.divMin) : null;

    return rows.filter((r) => {
      if (filters.sector !== "all" && r.sector !== filters.sector) return false;
      if (q && !r.ticker.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
      if (peMax !== null && (r.pe_ratio === null || r.pe_ratio > peMax || r.pe_ratio <= 0)) return false;
      if (pbMax !== null && (r.pb_ratio === null || r.pb_ratio > pbMax)) return false;
      if (roeMinFrac !== null && (r.roe === null || r.roe < roeMinFrac)) return false;
      if (divMinPct !== null && (r.dividend_yield === null || r.dividend_yield < divMinPct)) return false;
      return true;
    });
  }, [rows, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // nulls last
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  function toggleSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      // Numeric columns typically want descending default (highest first)
      setSortDir(NUMERIC_KEYS.includes(k) ? "desc" : "asc");
    }
    setPage(0);
  }

  function update<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">티커 · 이름</label>
            <Input
              placeholder="AAPL, Apple..."
              value={filters.q}
              onChange={(e) => update("q", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">섹터</label>
            <Select value={filters.sector} onValueChange={(v) => update("sector", (v as string) ?? "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 섹터</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">PER 최대</label>
            <Input
              type="number"
              placeholder="예: 25"
              value={filters.peMax}
              onChange={(e) => update("peMax", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">PBR 최대</label>
            <Input
              type="number"
              placeholder="예: 5"
              value={filters.pbMax}
              onChange={(e) => update("pbMax", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">ROE 최소 (%)</label>
            <Input
              type="number"
              placeholder="예: 15"
              value={filters.roeMin}
              onChange={(e) => update("roeMin", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">배당수익률 최소 (%)</label>
            <Input
              type="number"
              placeholder="예: 2"
              value={filters.divMin}
              onChange={(e) => update("divMin", e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {sorted.length.toLocaleString()} / {rows.length.toLocaleString()} 종목
          </span>
          <Button variant="outline" size="sm" onClick={() => setFilters(initialFilters)}>
            초기화
          </Button>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/60 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
              <tr>
                <Th active={sortKey === "ticker"} dir={sortDir} onClick={() => toggleSort("ticker")}>
                  Ticker
                </Th>
                <Th active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")}>
                  회사명
                </Th>
                <Th active={sortKey === "sector"} dir={sortDir} onClick={() => toggleSort("sector")}>
                  섹터
                </Th>
                <Th
                  active={sortKey === "pe_ratio"}
                  dir={sortDir}
                  onClick={() => toggleSort("pe_ratio")}
                  align="right"
                >
                  PER
                </Th>
                <Th
                  active={sortKey === "pb_ratio"}
                  dir={sortDir}
                  onClick={() => toggleSort("pb_ratio")}
                  align="right"
                >
                  PBR
                </Th>
                <Th
                  active={sortKey === "roe"}
                  dir={sortDir}
                  onClick={() => toggleSort("roe")}
                  align="right"
                >
                  ROE
                </Th>
                <Th
                  active={sortKey === "dividend_yield"}
                  dir={sortDir}
                  onClick={() => toggleSort("dividend_yield")}
                  align="right"
                >
                  배당%
                </Th>
                <Th
                  active={sortKey === "beta"}
                  dir={sortDir}
                  onClick={() => toggleSort("beta")}
                  align="right"
                >
                  β
                </Th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr
                  key={r.ticker}
                  className="border-b border-border/30 transition-colors hover:bg-muted/20"
                >
                  <td className="px-3 py-2 font-mono text-xs font-semibold">
                    <Link href={`/stock?ticker=${r.ticker}`} className="text-primary hover:underline">
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2">{r.name}</td>
                  <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                    {r.sector}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.pe_ratio !== null && r.pe_ratio > 0 ? r.pe_ratio.toFixed(1) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.pb_ratio !== null ? r.pb_ratio.toFixed(2) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.roe !== null ? `${(r.roe * 100).toFixed(1)}%` : "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.dividend_yield !== null && r.dividend_yield > 0
                      ? `${r.dividend_yield.toFixed(2)}%`
                      : "-"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.beta !== null ? r.beta.toFixed(2) : "-"}
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    조건에 맞는 종목이 없습니다. 필터를 완화해보세요.
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
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            이전
          </Button>
          <span className="text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  active,
  dir,
  onClick,
  align,
}: {
  children: React.ReactNode;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "right";
}) {
  return (
    <th
      className={cn(
        "cursor-pointer select-none px-3 py-2 whitespace-nowrap hover:text-foreground",
        align === "right" && "text-right",
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active &&
          (dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </span>
    </th>
  );
}
