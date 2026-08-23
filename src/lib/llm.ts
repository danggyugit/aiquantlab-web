/**
 * Server-side helper for AI-generated summaries via the FastAPI /llm/* proxy.
 * The Gemini API key stays on the server; browser never sees it.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export type EarningsSummaryRequest = {
  symbol: string;
  name?: string;
  price?: number | null;
  market_cap?: number | null;
  pe?: number | null;
  sector?: string | null;
  forward_eps?: number | null;
  revenue_growth_yoy?: number | null;
  gross_margin?: number | null;
  analyst_target_mean?: number | null;
  earnings_history?: Array<{
    period: string;
    actual: number;
    estimate: number;
    surprisePercent: number;
  }>;
};

export type EarningsSummaryResponse = {
  summary_md: string;
  model: string;
} | null;

/**
 * POST /llm/earnings-summary — returns Korean markdown summary in 5 sections.
 * Returns null on any failure (missing key, timeout, upstream error) so the
 * page can render a graceful fallback.
 */
export async function getEarningsSummary(req: EarningsSummaryRequest): Promise<EarningsSummaryResponse> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/llm/earnings-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      next: { revalidate: 21600 },  // 6h — matches backend cache
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) return null;
    return (await res.json()) as EarningsSummaryResponse;
  } catch {
    return null;
  }
}
