/**
 * Server-side helpers for talking to the FastAPI Finnhub proxy.
 * All keys stay on the server — the browser never sees them.
 * Every helper returns `null` on failure so page components can render
 * a "not configured / unavailable" fallback instead of erroring.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

async function safeGet<T>(path: string, revalidateSec = 900, timeoutMs = 8000): Promise<T | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: revalidateSec },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type NewsItem = {
  headline: string;
  summary: string;
  source: string;
  url: string;
  image?: string;
  datetime: number; // unix seconds
  category?: string;
  sentiment?: number;
};

export type PriceTarget = {
  symbol: string;
  targetHigh: number;
  targetLow: number;
  targetMean: number;
  targetMedian: number;
  lastUpdated: string;
};

export type RecommendationRow = {
  symbol: string;
  period: string;         // "2026-08-01"
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

/** Recent company news (default: last 14 days). */
export async function getCompanyNews(ticker: string, days = 14): Promise<NewsItem[] | null> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return safeGet<NewsItem[]>(
    `/finnhub/company-news?symbol=${encodeURIComponent(ticker)}&from_date=${fmt(from)}&to_date=${fmt(to)}`,
    600,
  );
}

/** General market news. */
export async function getMarketNews(category = "general"): Promise<NewsItem[] | null> {
  return safeGet<NewsItem[]>(`/finnhub/market-news?category=${encodeURIComponent(category)}`, 600);
}

/** Analyst consensus price target. */
export async function getPriceTarget(ticker: string): Promise<PriceTarget | null> {
  const data = await safeGet<PriceTarget>(`/finnhub/price-target?symbol=${encodeURIComponent(ticker)}`, 3600);
  // Finnhub returns an empty object when the ticker has no coverage.
  if (!data || !data.targetMean) return null;
  return data;
}

/** Analyst recommendation trend by month. */
export async function getRecommendation(ticker: string): Promise<RecommendationRow[] | null> {
  const data = await safeGet<RecommendationRow[]>(`/finnhub/recommendation?symbol=${encodeURIComponent(ticker)}`, 3600);
  if (!data || data.length === 0) return null;
  return data;
}
