"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchMarketNewsClient } from "@/lib/finnhub";
import type { NewsItem } from "@/lib/finnhub";
import { cn } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "ready"; items: NewsItem[] }
  | { kind: "empty" }
  | { kind: "error" };

/**
 * Sentiment page's "시장 헤드라인" section as a client component.
 *
 * Server-side fetch was hitting Render's 8s safeGet timeout during
 * cold starts (Render free tier sleeps after 15min idle → wake takes
 * 20-60s). Client-side fetch with a 60s timeout lets the page render
 * instantly and populates news whenever the backend is ready.
 */
export function MarketNewsClient({ category = "general" }: { category?: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchMarketNewsClient(category)
      .then((items) => {
        if (cancelled) return;
        if (!items) setState({ kind: "error" });
        else if (items.length === 0) setState({ kind: "empty" });
        else setState({ kind: "ready", items });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [category, reloadKey]);

  const count = state.kind === "ready" ? state.items.length : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Finnhub Market News</CardTitle>
            <CardDescription className="text-xs">
              {count}건 · 실시간 시장 헤드라인
            </CardDescription>
          </div>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={state.kind === "loading"}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[11px] font-semibold",
              "text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary",
              "disabled:opacity-50",
            )}
          >
            <RefreshCw className={cn("h-3 w-3", state.kind === "loading" && "animate-spin")} />
            새로고침
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {state.kind === "loading" && (
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>불러오는 중... (Render 무료 티어 콜드 스타트 시 최대 60초 소요)</p>
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg border border-border/30 bg-muted/20" />
              ))}
            </div>
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-destructive">뉴스를 불러올 수 없습니다.</p>
            <p className="text-muted-foreground">
              백엔드 API가 응답하지 않거나 콜드 스타트 시간이 60초를 넘었습니다.
              새로고침 버튼을 눌러 다시 시도해 보세요.
            </p>
          </div>
        )}

        {state.kind === "empty" && (
          <p className="text-xs text-muted-foreground">최근 헤드라인이 없습니다.</p>
        )}

        {state.kind === "ready" && (
          <div className="flex flex-col gap-2">
            {state.items.slice(0, 15).map((n, i) => (
              <a
                key={i}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border border-border/40 bg-card/40 p-3 transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-medium group-hover:text-primary">{n.headline}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(n.datetime * 1000).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                  </span>
                </div>
                {n.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.summary}</p>}
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{n.source}</span>
                  {n.category && <Badge variant="secondary" className="text-[9px]">{n.category}</Badge>}
                </div>
              </a>
            ))}
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          종목별 뉴스는 <a href="/stock" className="text-primary hover:underline">종목 상세 페이지</a>에서 검색 후 확인.
        </p>
      </CardContent>
    </Card>
  );
}
