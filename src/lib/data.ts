/**
 * Fetch cached JSON snapshots from the stock-dashboard repo (GitHub raw).
 *
 * The Streamlit backend precomputes these files via a Windows scheduler and
 * commits them to `streamlit_app/data/cache/`. We reuse the same URLs so we
 * don't duplicate the data pipeline.
 *
 * TTL: 15 min (900s) — matches Streamlit's @st.cache_data(ttl=900).
 */

const CACHE_BASE =
  "https://raw.githubusercontent.com/danggyugit/stock-dashboard/main/streamlit_app/data/cache";

const REVALIDATE_SECONDS = 900;

async function fetchCache<T>(filename: string): Promise<T> {
  const res = await fetch(`${CACHE_BASE}/${filename}`, {
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${filename}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------- Types (mirror stock-dashboard cache JSON) ----------

export type Trend = "up" | "down" | "flat";

export type VixData = {
  current: number;
  min: number;
  max: number;
  avg: number;
  trend: Trend;
  history: Array<{ date: string; close: number }>;
};

export type Sector = {
  ticker: string;
  sector: string;
  ret_1w_pct: number;
  ret_1m_pct: number;
};

export type Commodity = {
  label: string;
  current: number;
  min: number;
  max: number;
  avg: number;
  trend: Trend;
};

export type Commodities = {
  dxy: Commodity;
  gold: Commodity;
  oil_wti: Commodity;
};

export type Breadth = {
  spy_close: number;
  sma200: number;
  above_pct: number;
};

export type MarketSnapshot = {
  updated_at: string;
  vix: VixData;
  sectors: Sector[];
  commodities: Commodities;
  breadth: Breadth;
  risk_on_off?: unknown;
  fear_greed?: unknown;
};

export type HeatmapPricePoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type HeatmapTicker = {
  name: string;
  sector: string;
  market_cap: number;
  prices: HeatmapPricePoint[];
};

export type HeatmapData = {
  updated_at: string;
  tickers: Record<string, HeatmapTicker>;
};

// ---------- Fetchers ----------

export function getMarketSnapshot(): Promise<MarketSnapshot> {
  return fetchCache<MarketSnapshot>("market_snapshot.json");
}

export function getHeatmap(): Promise<HeatmapData> {
  return fetchCache<HeatmapData>("heatmap.json");
}

// ---------- Derived helpers ----------

/** Latest price + %change (close vs prior close) from a HeatmapTicker. */
export function latestQuote(t: HeatmapTicker): { price: number; changePct: number } | null {
  const p = t.prices;
  if (!p || p.length < 2) return null;
  const last = p[p.length - 1];
  const prev = p[p.length - 2];
  const changePct = ((last.close - prev.close) / prev.close) * 100;
  return { price: last.close, changePct };
}

/** Format a large number as USD with abbreviated suffix. */
export function fmtMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
