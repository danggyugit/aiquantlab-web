"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitCompareArrows, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const WL_KEY = "aiql:watchlist:v1";

type WatchlistItem = {
  id: string;
  ticker: string;
  note?: string;
  addedAt: string;
  priceAtAdd?: number;
};

function loadWL(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WL_KEY);
    return raw ? (JSON.parse(raw) as WatchlistItem[]) : [];
  } catch {
    return [];
  }
}

function saveWL(items: WatchlistItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WL_KEY, JSON.stringify(items));
}

/**
 * Stock detail page action bar — watchlist toggle + compare shortcut.
 * Mirrors what a user typically wants immediately after landing on a ticker page.
 */
export function StockActions({ ticker, price }: { ticker: string; price?: number }) {
  const [inWatchlist, setInWatchlist] = useState(false);

  useEffect(() => {
    setInWatchlist(loadWL().some((i) => i.ticker === ticker));
  }, [ticker]);

  function toggleWatchlist() {
    const current = loadWL();
    const exists = current.some((i) => i.ticker === ticker);
    if (exists) {
      const next = current.filter((i) => i.ticker !== ticker);
      saveWL(next);
      setInWatchlist(false);
      toast.info(`${ticker} 관심목록에서 제거`);
    } else {
      const item: WatchlistItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ticker,
        addedAt: new Date().toISOString(),
        priceAtAdd: price,
      };
      saveWL([...current, item]);
      setInWatchlist(true);
      toast.success(`${ticker} 관심목록 추가`);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={inWatchlist ? "secondary" : "default"}
        size="sm"
        onClick={toggleWatchlist}
        className="gap-1.5"
      >
        {inWatchlist ? <StarOff className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
        {inWatchlist ? "관심목록에서 제거" : "관심목록 추가"}
      </Button>
      <Link
        href={`/compare?tickers=${ticker}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-sm font-medium hover:bg-muted/40"
      >
        <GitCompareArrows className="h-3.5 w-3.5" /> 다른 종목과 비교
      </Link>
    </div>
  );
}
