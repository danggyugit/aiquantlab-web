"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

type Row = { ticker: string; name: string; sector: string };

export function StockSearchClient({ stocks }: { stocks: Row[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toUpperCase();
    if (!query) return stocks.slice(0, 30);
    return stocks
      .filter((s) => s.ticker.startsWith(query) || s.name.toUpperCase().includes(query))
      .slice(0, 40);
  }, [q, stocks]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="티커 또는 회사명 (AAPL, Apple, Microsoft...)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-border/30">
          {filtered.map((s) => (
            <li key={s.ticker}>
              <Link
                href={`/stock/${s.ticker}`}
                className="flex items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-muted/30"
              >
                <span className="flex items-center gap-3">
                  <span className="w-14 font-mono text-xs font-semibold text-primary">{s.ticker}</span>
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{s.sector}</span>
              </Link>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">검색 결과 없음</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
