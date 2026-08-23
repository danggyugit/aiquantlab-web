"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * Client-side fetch for the Gemini earnings summary.
 * Moved off the server because Render Free's cold start + Gemini generation
 * can exceed Vercel Hobby's 10s serverless timeout, killing the SSR request
 * before the summary comes back.
 */

type Props = {
  symbol: string;
  name: string;
  price?: number | null;
  market_cap?: number | null;
  pe?: number | null;
  sector?: string | null;
  analyst_target_mean?: number | null;
  earnings_history: Array<{
    period: string;
    actual: number;
    estimate: number;
    surprisePercent: number;
  }>;
};

export function AiEarningsSummary(props: Props) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; summary: string; model: string }
    | { kind: "no-key" }
    | { kind: "error"; msg: string }
  >({ kind: "loading" });
  // Bump to force a re-fetch even when props are identical (busts any
  // in-memory server cache and any lingering client-side memoization).
  const [refetchTick, setRefetchTick] = useState(0);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    if (!apiBase) {
      setState({ kind: "error", msg: "NEXT_PUBLIC_API_URL 미설정" });
      return;
    }
    setState({ kind: "loading" });
    const controller = new AbortController();
    (async () => {
      try {
        // First render uses server cache (fast if hit); regenerate button
        // (refetchTick > 0) forces fresh Gemini call by bypassing that cache.
        const freshQs = refetchTick > 0 ? "?fresh=true" : "";
        const res = await fetch(`${apiBase}/llm/earnings-summary${freshQs}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(props),
          signal: controller.signal,
          cache: "no-store",   // never let any layer cache this
        });
        if (res.status === 503) {
          setState({ kind: "no-key" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", msg: `API ${res.status}` });
          return;
        }
        const data = (await res.json()) as { summary_md: string; model: string };
        setState({ kind: "ok", summary: data.summary_md, model: data.model });
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setState({ kind: "error", msg: (e as Error).message });
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.symbol, refetchTick]);

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Gemini 요약 생성 중… (첫 요청은 Render 콜드 스타트로 최대 30초)
      </div>
    );
  }
  if (state.kind === "no-key") {
    return (
      <p className="text-xs text-muted-foreground">
        Render 환경변수 <code className="rounded bg-black/30 px-1">GEMINI_API_KEY</code> 미설정.
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p className="text-xs text-destructive">AI 요약 실패: {state.msg}</p>
    );
  }
  const summary = state.summary;
  const suspiciouslyShort = summary.length < 300;

  return (
    <div className="flex flex-col gap-2">
      {suspiciouslyShort && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-100/90">
          ⚠️ 응답이 짧습니다 ({summary.length}자). 백엔드 캐시가 오래된 버전일 수 있음 —
          우측 <strong>재생성</strong> 버튼을 눌러보세요.
        </div>
      )}
      <div
        className="prose prose-sm prose-invert max-w-none [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-premium [&_h2:first-child]:mt-0 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0 [&_p]:my-1 [&_p]:text-sm"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(summary) }}
      />
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[10px] text-muted-foreground">
          Powered by {state.model} · {summary.length}자 · 데이터 기반 자동 생성 · 투자 조언이 아님
        </p>
        <button
          onClick={() => setRefetchTick((n) => n + 1)}
          className="inline-flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[10px] hover:bg-muted/40"
          title="응답 재생성 (백엔드 캐시가 오래되었다면 강제 재요청)"
        >
          <RefreshCw className="h-3 w-3" /> 재생성
        </button>
      </div>
    </div>
  );
}

// Minimal markdown → HTML renderer. Handles the formats Gemini actually
// produces for our prompt: ## headings, **bold**, - bullets, and also
// "1. Text" pseudo-headings when the model omits the ## prefix.
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  // Match "1. 실적 품질" (with or without ## prefix stripped by the model)
  const pseudoHeadingRe = /^(\d+)\.\s+([가-힣A-Za-z].{0,40})$/;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    const l = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (l.startsWith("## ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${l.slice(3)}</h2>`);
    } else if (l.startsWith("# ")) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${l.slice(2)}</h2>`);
    } else if (l.startsWith("- ") || l.startsWith("* ")) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${l.slice(2)}</li>`);
    } else {
      // Fallback: standalone numbered line = section heading
      const m = pseudoHeadingRe.exec(l);
      if (m) {
        if (inList) { out.push("</ul>"); inList = false; }
        out.push(`<h2>${m[1]}. ${m[2]}</h2>`);
      } else {
        if (inList) { out.push("</ul>"); inList = false; }
        out.push(`<p>${l}</p>`);
      }
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
}
