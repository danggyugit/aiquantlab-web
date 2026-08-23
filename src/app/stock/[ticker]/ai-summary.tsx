"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
    if (!apiBase) {
      setState({ kind: "error", msg: "API URL 미설정" });
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${apiBase}/llm/earnings-summary`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(props),
          signal: controller.signal,
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
  }, [props.symbol]);

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
  return (
    <div className="flex flex-col gap-2">
      <div
        className="prose prose-sm prose-invert max-w-none [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-premium [&_h2:first-child]:mt-0 [&_ul]:my-1 [&_ul]:pl-4 [&_li]:my-0 [&_p]:my-1 [&_p]:text-sm"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(state.summary) }}
      />
      <p className="text-[10px] text-muted-foreground">
        Powered by {state.model} · 데이터 기반 자동 생성 · 투자 조언이 아님
      </p>
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
