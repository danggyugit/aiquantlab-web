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

// Fundamentals per ticker (screener 재료)
export type Fundamental = {
  pe_ratio: number | null;
  pb_ratio: number | null;
  ps_ratio: number | null;
  eps: number | null;
  roe: number | null;
  debt_to_equity: number | null;
  dividend_yield: number | null;
  beta: number | null;
  fifty_two_week_high: number | null;
  fifty_two_week_low: number | null;
  avg_volume: number | null;
  shares_outstanding: number | null;
  book_value: number | null;
  trailing_annual_dividend_rate: number | null;
  revenue_per_share: number | null;
};

export type FundamentalsData = {
  updated_at: string;
  tickers: Record<string, Fundamental>;
};

// Stocks metadata list (ticker · name · sector · industry · cap_tier)
export type StockMeta = {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  cap_tier: string;
};

// Backtest preset (from data/cache/backtests/*.json).
// Mirrors the Streamlit factor_backtest_service output verbatim.

export type BacktestConfig = {
  cap_tiers: string[];
  sectors: string[];
  rebal_m: number;              // rebalance months
  rolling_w: number;            // rolling window months
  n_stocks: number;
  tc_pct: number;               // transaction cost %
  min_dollar_vol: number;
  use_next_open: boolean;
  use_surv_fix: boolean;
  use_ensemble: boolean;
  use_mom_filter: boolean;
  use_turnover_buffer: boolean;
  start: string;                // ISO
  end: string;                  // ISO
  min_test: number;
  use_inv_vol_weight: boolean;
  use_momentum_weight: boolean;
  cash_strategy: "none" | "vol_target" | "regime" | "combined";
};

export type BacktestSummary = {
  n_rebalances?: number;
  total_return_pct?: number;
  cagr_pct?: number;
  sharpe?: number;
  sortino?: number;
  max_dd_pct?: number;
  monthly_win_rate_pct?: number;
  volatility_pct?: number | null;
  rebal_win_rate_pct?: number;
  avg_period_return_pct?: number;
  avg_excess_return_pct?: number;
  profit_factor?: number;
};

// Today's/latest pick with weight and score
export type TodayPick = {
  ticker: string;
  weight?: number;
  composite_score?: number;
  Mom_1m?: number;
  Mom_3m?: number;
  Mom_6m?: number;
  Mom_12m?: number;
  Volatility_30d?: number;
};

// Rebalancing event with selected stocks
export type RebalanceEvent = {
  rebalance_date: string;
  next_date: string;
  holding_period: string;
  learn_start: string;
  selected: string[];
  ticker_df?: Array<{
    ticker: string;
    비중?: string;
    예측수익률?: number;
    실제수익률?: number;
  }>;
};

// Cash ratio per rebalance date
export type CashRecord = {
  date: string;
  cash_ratio: number;
  regime?: string;
  regime_probs?: unknown;
  realized_vol?: number | null;
};

// IC (Information Coefficient) record per rebalance
export type IcRecord = {
  date: string;
  IC?: number;
  IC_RF?: number;
  IC_XGB?: number;
  IC_LGBM?: number;
};

// Feature importance per rebalance (dynamic keys per feature name)
export type ImportanceRecord = Record<string, number | string>;

// Latest full ranking entry
export type RankingEntry = {
  ticker: string;
  composite_score?: number;
  Mom_1m?: number;
  Mom_3m?: number;
  Mom_6m?: number;
  Mom_12m?: number;
  Volatility_30d?: number;
};

export type BacktestFull = {
  port_dates: string[];         // equity curve dates
  port_values: number[];        // equity curve values (starts at 1.0)
  rebal_hist: RebalanceEvent[];
  cash_history: CashRecord[];
  ic_records: IcRecord[];
  fimp_data: ImportanceRecord[];       // combined
  fimp_rf_data: ImportanceRecord[];    // random forest
  fimp_xgb_data: ImportanceRecord[];   // xgboost (may be empty)
  fimp_lgbm_data: ImportanceRecord[];  // lightgbm (may be empty)
  last_full_ranking: RankingEntry[];
  use_ensemble: boolean;
  rebal_m: number;
  cash_strategy: string;
};

export type BacktestPreset = {
  preset_id: string;
  name: string;
  description: string;
  config: BacktestConfig;
  summary: BacktestSummary;
  last_rebalance_date?: string;
  last_regime?: string;
  last_cash_ratio_pct?: number;
  latest_picks?: TodayPick[];
  today_picks?: TodayPick[];
  today_full_ranking?: RankingEntry[];
  today_picks_at?: string;
  today_regime?: string | null;
  today_cash_ratio_pct?: number | null;
  full?: BacktestFull;
  updated_at?: string;
};

// 50-preset matrix: 10 sectors × 5 strategies (see
// stock-dashboard/streamlit_app/scripts/run_preset_backtests.py:SECTORS + STRATEGIES).
// Sector codes: it, hc, fin, cd, cs, ind, staples, en, mat, re
// Strategy codes: equal, momentum, invvol, ensemble, regime
export const BACKTEST_SECTORS = [
  { key: "it",       short: "IT",             full: "Information Technology" },
  { key: "hc",       short: "Health Care",    full: "Health Care" },
  { key: "fin",      short: "Financials",     full: "Financials" },
  { key: "cd",       short: "Consumer Disc.", full: "Consumer Discretionary" },
  { key: "cs",       short: "Comm. Services", full: "Communication Services" },
  { key: "ind",      short: "Industrials",    full: "Industrials" },
  { key: "staples",  short: "Consumer Stap.", full: "Consumer Staples" },
  { key: "en",       short: "Energy",         full: "Energy" },
  { key: "mat",      short: "Materials",      full: "Materials" },
  { key: "re",       short: "Real Estate",    full: "Real Estate" },
] as const;

export const BACKTEST_STRATEGIES = [
  { key: "equal",    label: "Equal Weight" },
  { key: "momentum", label: "Momentum-Weight" },
  { key: "invvol",   label: "Inverse-Vol" },
  { key: "ensemble", label: "Ensemble ML + Inv-Vol" },
  { key: "regime",   label: "Inv-Vol + Regime Cash" },
] as const;

export const BACKTEST_PRESET_IDS: readonly string[] = BACKTEST_SECTORS.flatMap((s) =>
  BACKTEST_STRATEGIES.map((st) => `${s.key}_${st.key}`),
);

// 13F holding entry (from data/cache/sec/13f/*.json)
export type Holding13F = {
  company: string;            // e.g., "AMERICAN EXPRESS CO"
  cusip?: string;
  ticker?: string;            // may be missing for some filings
  shares?: number;
  value_k?: number;           // thousands
  value_usd?: number;         // dollars
  shr_type?: string;          // "SH" | "PRN"
  pct_port?: number;          // percentage of portfolio
};

export type Filing13F = {
  cik: string;
  name: string;             // fund name
  manager?: string;         // portfolio manager name
  style?: string;
  period: string;           // YYYYMMDD
  filed_date?: string;
  holdings: Holding13F[];
  fetched_at?: string;
};

export type Sec13FMetaEntry = {
  latest_period: string;   // YYYY-MM-DD
  filed_date?: string;
  fetched_at?: string;
  accession_no?: string;
};

export type Sec13FMetadata = {
  "13f": Record<string, Sec13FMetaEntry>;   // cik → entry
  updated_at?: string;
};

// ---------- Fetchers ----------

export function getMarketSnapshot(): Promise<MarketSnapshot> {
  return fetchCache<MarketSnapshot>("market_snapshot.json");
}

export function getHeatmap(): Promise<HeatmapData> {
  return fetchCache<HeatmapData>("heatmap.json");
}

export function getFundamentals(): Promise<FundamentalsData> {
  return fetchCache<FundamentalsData>("fundamentals.json");
}

export function getStocksMeta(): Promise<StockMeta[]> {
  return fetchCache<StockMeta[]>("stocks.json");
}

export function getBacktestPreset(id: string): Promise<BacktestPreset> {
  return fetchCache<BacktestPreset>(`backtests/${id}.json`);
}

export async function getAllBacktestPresets(): Promise<BacktestPreset[]> {
  // Not all 50 presets may exist yet (initial rollout, or Windows scheduler
  // partially failed). Fetch tolerantly and filter out missing ones so the
  // UI shows whatever's available instead of failing the whole build.
  const results = await Promise.allSettled(
    BACKTEST_PRESET_IDS.map((id) => getBacktestPreset(id)),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<BacktestPreset> => r.status === "fulfilled")
    .map((r) => r.value);
}

/** sec/_metadata.json — one entry per CIK with latest_period. */
export function getSec13FMetadata(): Promise<Sec13FMetadata> {
  return fetchCache<Sec13FMetadata>("sec/_metadata.json");
}

/** Convert "YYYY-MM-DD" to "YYYYMMDD" (13F filename format). */
export function periodToFileSuffix(period: string): string {
  return period.replace(/-/g, "");
}

/** Fetch a single 13F filing. Filename = `{cik}_{YYYYMMDD}.json`. */
export function get13FFiling(cik: string, period: string): Promise<Filing13F> {
  const suffix = periodToFileSuffix(period);
  return fetchCache<Filing13F>(`sec/13f/${cik}_${suffix}.json`);
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

/**
 * Period-return % between the first and last close in the ticker's price series.
 * Note: current cache only stores ~5 recent trading days, so this represents
 * short-term (weekly) momentum, NOT the standard 12M IBD RS Rating.
 */
export function periodReturn(t: HeatmapTicker): number | null {
  const p = t.prices;
  if (!p || p.length < 2) return null;
  const first = p[0];
  const last = p[p.length - 1];
  if (!first?.close) return null;
  return ((last.close - first.close) / first.close) * 100;
}

/** Distance from the 52-week high as a % of the high (0 = at high, -20 = 20% below). */
export function distanceFromHigh(current: number, fiftyTwoWkHigh: number | null): number | null {
  if (!fiftyTwoWkHigh || fiftyTwoWkHigh <= 0) return null;
  return ((current - fiftyTwoWkHigh) / fiftyTwoWkHigh) * 100;
}

/** Format a large number as USD with abbreviated suffix. Returns "-" for null/0. */
export function fmtMarketCap(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return "-";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
