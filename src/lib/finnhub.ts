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

export type EarningsSurpriseRow = {
  symbol: string;
  period: string;             // "YYYY-MM-DD" — quarter end
  year: number;
  quarter: number;            // 1..4
  actual: number;
  estimate: number;
  surprise: number;
  surprisePercent: number;
};

/** Last 4 quarters of actual vs estimate EPS. */
export async function getEarningsSurprise(ticker: string): Promise<EarningsSurpriseRow[] | null> {
  const data = await safeGet<EarningsSurpriseRow[]>(`/finnhub/earnings-surprise?symbol=${encodeURIComponent(ticker)}`, 3600);
  if (!data || data.length === 0) return null;
  return data;
}

export type InsiderTx = {
  name: string;               // insider name (typically ALL CAPS)
  share: number;              // shares held AFTER the transaction
  change: number;             // + = buy, - = sell
  filingDate: string;         // when SEC Form 4 was filed
  transactionDate: string;    // when the trade happened
  transactionCode: string;    // "P" = purchase, "S" = sale, "A" = grant, etc.
  transactionPrice: number;
  currency?: string;
  isDerivative?: boolean;
  position?: string;          // "CEO", "CFO", "10% Owner", ...
  symbol?: string;
};

/** SEC Form 4 insider transactions (default: last 6 months from today). */
export async function getInsiderTransactions(ticker: string, days = 180): Promise<InsiderTx[] | null> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await safeGet<InsiderTx[]>(
    `/finnhub/insider-transactions?symbol=${encodeURIComponent(ticker)}&from_date=${fmt(from)}&to_date=${fmt(to)}`,
    1800,
  );
  if (!data || data.length === 0) return null;
  return data;
}

/**
 * Big grab-bag of metrics per ticker — growth rates (revenue/EPS 5y CAGR),
 * margins, valuation multiples (PEG, EV/EBITDA, P/FCF), dividend info,
 * beta, 52w, etc. Field names come straight from Finnhub — see
 * https://finnhub.io/docs/api/company-basic-financials
 */
export type FinnhubMetric = Record<string, number | string | null | undefined> & {
  peBasicExclExtraTTM?: number;
  pbAnnual?: number;
  psTTM?: number;
  pfcfShareTTM?: number;
  epsGrowth3Y?: number;
  epsGrowth5Y?: number;
  revenueGrowth3Y?: number;
  revenueGrowth5Y?: number;
  grossMarginTTM?: number;
  operatingMarginTTM?: number;
  netProfitMarginTTM?: number;
  roeTTM?: number;
  roaTTM?: number;
  currentRatioAnnual?: number;
  longTermDebt_capitalAnnual?: number;
  totalDebt_totalEquityAnnual?: number;
  dividendYieldIndicatedAnnual?: number;
  dividendPerShareAnnual?: number;
  dividendGrowthRate5Y?: number;
  payoutRatioAnnual?: number;
  beta?: number;
  "52WeekHigh"?: number;
  "52WeekLow"?: number;
  freeCashFlowTTM?: number;
  freeCashFlowPerShareTTM?: number;
  netBuybacksTTM?: number;
  epsAnnual?: number;
  fcfMargin5Y?: number;
};

export async function getMetrics(ticker: string): Promise<FinnhubMetric | null> {
  const data = await safeGet<FinnhubMetric>(`/finnhub/metric?symbol=${encodeURIComponent(ticker)}`, 6 * 3600);
  if (!data || Object.keys(data).length === 0) return null;
  return data;
}

export type FinancialFiling = {
  symbol: string;
  cik: string;
  year: number;
  quarter: number;
  form: string;
  startDate: string;
  endDate: string;
  filedDate: string;
  acceptedDate: string;
  report: {
    ic?: FinancialConcept[];  // income statement
    bs?: FinancialConcept[];  // balance sheet
    cf?: FinancialConcept[];  // cash flow
  };
};

export type FinancialConcept = {
  concept: string;
  unit: string;
  label: string;
  value: number;
};

export async function getFinancials(ticker: string, freq: "quarterly" | "annual" = "quarterly"): Promise<FinancialFiling[] | null> {
  const data = await safeGet<FinancialFiling[]>(
    `/finnhub/financials-reported?symbol=${encodeURIComponent(ticker)}&freq=${freq}`,
    6 * 3600,
  );
  if (!data || data.length === 0) return null;
  return data;
}

export type Dividend = {
  symbol: string;
  date: string;                // ex-dividend date
  amount: number;
  adjustedAmount?: number;
  payDate?: string;
  declarationDate?: string;
  recordDate?: string;
  currency?: string;
};

export async function getDividendHistory(ticker: string, years = 10): Promise<Dividend[] | null> {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - years);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await safeGet<Dividend[]>(
    `/finnhub/dividend-history?symbol=${encodeURIComponent(ticker)}&from_date=${fmt(from)}&to_date=${fmt(to)}`,
    6 * 3600,
  );
  if (!data || data.length === 0) return null;
  return data;
}

export type EpsEstimate = {
  period: string;              // "YYYY-MM-DD" quarter end
  epsAvg: number;
  epsHigh: number;
  epsLow: number;
  numberAnalysts: number;
};

export async function getEpsEstimate(ticker: string, freq: "quarterly" | "annual" = "quarterly"): Promise<EpsEstimate[] | null> {
  const data = await safeGet<EpsEstimate[]>(
    `/finnhub/eps-estimate?symbol=${encodeURIComponent(ticker)}&freq=${freq}`,
    3600,
  );
  if (!data || data.length === 0) return null;
  return data;
}
