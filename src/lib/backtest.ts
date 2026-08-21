/**
 * 클라이언트 사이드 팩터 스코어링·백테스트 엔진.
 *
 * 동작 방식:
 *   1) 유니버스 필터 (섹터·시가총액 티어)
 *   2) 선택 팩터별 백분위 스코어링 (0~100)
 *   3) 팩터 스코어 평균 → 종목별 종합 스코어
 *   4) Top N 픽 선정
 *   5) 가중치 계산 (equal / market-cap / inverse-vol)
 *   6) 포트폴리오 수익률 = Σ(weight × return)
 *   7) 벤치마크(유니버스 균등 평균) 대비 초과수익률 계산
 *
 * 데이터 한계:
 *   현재 heatmap 캐시가 최근 5거래일 종가만 저장 → 계산은 실제로 수행되지만,
 *   백테스트 기간이 짧아 통계적 유의성은 낮음. 12M 히스토리 캐시 추가 시
 *   Sharpe·Sortino 등의 지표가 의미 있어짐.
 */

// ---------- Types ----------

export type FactorId =
  | "pe_low"      // 저PER (가치)
  | "pb_low"      // 저PBR (가치)
  | "roe_high"    // 고ROE (수익성)
  | "div_high"    // 고배당 (인컴)
  | "beta_low"    // 저베타 (저변동)
  | "mom_high";   // 고모멘텀 (추세)

export type Weighting = "equal" | "mcap" | "invvol";

export type BacktestConfig = {
  factors: FactorId[];
  weighting: Weighting;
  sector: string;         // "all" or specific sector name
  capTier: string;        // "all" | "Large Cap" | "Mid Cap" | "Small Cap"
  nStocks: number;        // 5, 10, 20, 30
};

export type FactorDef = {
  id: FactorId;
  label: string;
  description: string;
  direction: "asc" | "desc";  // asc = lower is better (PE, Beta), desc = higher is better (ROE, Div)
};

export const FACTOR_LIBRARY: FactorDef[] = [
  { id: "pe_low", label: "저PER", description: "낮은 주가수익비율 (가치 팩터)", direction: "asc" },
  { id: "pb_low", label: "저PBR", description: "낮은 주가순자산비율 (가치 팩터)", direction: "asc" },
  { id: "roe_high", label: "고ROE", description: "높은 자기자본이익률 (퀄리티 팩터)", direction: "desc" },
  { id: "div_high", label: "고배당", description: "높은 배당수익률 (인컴 팩터)", direction: "desc" },
  { id: "beta_low", label: "저베타", description: "낮은 시장 민감도 (저변동성 팩터)", direction: "asc" },
  { id: "mom_high", label: "고모멘텀", description: "높은 최근 수익률 (추세 팩터)", direction: "desc" },
];

export type BacktestUniverseItem = {
  ticker: string;
  name: string;
  sector: string;
  capTier: string;
  marketCap: number;
  prices: { date: string; close: number }[];
  // Fundamentals (nullable — dropped from scoring if null)
  pe: number | null;
  pb: number | null;
  roe: number | null;
  div: number | null;
  beta: number | null;
};

export type PickWithMetrics = {
  ticker: string;
  name: string;
  sector: string;
  score: number;          // final combined 0-100
  weight: number;         // 0-1
  periodReturn: number;   // %
  volatility: number;     // annualized %, from daily returns
};

export type BacktestResult = {
  picks: PickWithMetrics[];
  portfolioReturn: number;      // %
  benchmarkReturn: number;      // %
  excessReturn: number;         // portfolio - benchmark, %
  volatility: number;           // portfolio annualized volatility, %
  bestPick: PickWithMetrics | null;
  worstPick: PickWithMetrics | null;
  sectorAllocation: Array<{ sector: string; weight: number }>;
  universeSize: number;
  dateStart: string;
  dateEnd: string;
  n_periods: number;            // # of daily observations in the backtest window
};

// ---------- Helpers ----------

/** Percentile-rank a numeric array (0-100). Null values excluded from ranking. */
function percentileRank(values: (number | null)[]): (number | null)[] {
  const withIdx = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null && !isNaN(x.v));

  withIdx.sort((a, b) => a.v - b.v);

  const ranks = new Array(values.length).fill(null as number | null);
  const total = withIdx.length;
  withIdx.forEach((x, rank) => {
    ranks[x.i] = total > 1 ? (rank / (total - 1)) * 100 : 50;
  });
  return ranks;
}

/** Simple period return: (last - first) / first * 100 */
function computePeriodReturn(prices: { close: number }[]): number {
  if (prices.length < 2) return 0;
  const first = prices[0].close;
  const last = prices[prices.length - 1].close;
  if (!first) return 0;
  return ((last - first) / first) * 100;
}

/** Annualized volatility from daily returns (%). */
function computeVolatility(prices: { close: number }[]): number {
  if (prices.length < 2) return 0;
  const daily: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].close;
    const cur = prices[i].close;
    if (prev > 0) daily.push((cur - prev) / prev);
  }
  if (daily.length === 0) return 0;
  const mean = daily.reduce((a, b) => a + b, 0) / daily.length;
  const variance = daily.reduce((a, b) => a + (b - mean) ** 2, 0) / daily.length;
  const stddev = Math.sqrt(variance);
  return stddev * Math.sqrt(252) * 100;
}

/** Get raw factor value for scoring — sign-flipped for "lower is better" factors. */
function getFactorValue(item: BacktestUniverseItem, factor: FactorId): number | null {
  switch (factor) {
    case "pe_low":
      return item.pe && item.pe > 0 ? -item.pe : null;   // flip sign so higher-rank = better
    case "pb_low":
      return item.pb ? -item.pb : null;
    case "roe_high":
      return item.roe;
    case "div_high":
      return item.div && item.div > 0 ? item.div : null;
    case "beta_low":
      return item.beta ? -item.beta : null;
    case "mom_high":
      return computePeriodReturn(item.prices);
  }
}

/** Compute inverse-volatility weights, normalized to sum to 1. */
function invVolWeights(picks: PickWithMetrics[]): number[] {
  const invVols = picks.map((p) => (p.volatility > 0 ? 1 / p.volatility : 0));
  const total = invVols.reduce((a, b) => a + b, 0);
  return total > 0 ? invVols.map((iv) => iv / total) : picks.map(() => 1 / picks.length);
}

// ---------- Main engine ----------

export function runBacktest(
  universe: BacktestUniverseItem[],
  config: BacktestConfig,
): BacktestResult {
  // 1) Filter universe
  const filtered = universe.filter((u) => {
    if (config.sector !== "all" && u.sector !== config.sector) return false;
    if (config.capTier !== "all" && u.capTier !== config.capTier) return false;
    if (u.prices.length < 2) return false;
    return true;
  });

  if (filtered.length === 0) {
    return emptyResult();
  }

  // 2) Score each stock across selected factors
  const factorRankings: Record<FactorId, (number | null)[]> = {} as Record<FactorId, (number | null)[]>;
  for (const f of config.factors) {
    const rawValues = filtered.map((item) => getFactorValue(item, f));
    factorRankings[f] = percentileRank(rawValues);
  }

  // Composite score = mean of factor percentiles (only across factors with valid rank)
  const scores = filtered.map((_, i) => {
    const ranks = config.factors.map((f) => factorRankings[f][i]).filter((r): r is number => r !== null);
    if (ranks.length === 0) return 0;
    return ranks.reduce((a, b) => a + b, 0) / ranks.length;
  });

  // 3) Rank and pick top N
  const scored = filtered.map((item, i) => ({ item, score: scores[i] }));
  scored.sort((a, b) => b.score - a.score);
  const topN = scored.slice(0, config.nStocks);

  // Compute per-pick metrics
  const picksInit: PickWithMetrics[] = topN.map((s) => ({
    ticker: s.item.ticker,
    name: s.item.name,
    sector: s.item.sector,
    score: s.score,
    weight: 0,   // filled below
    periodReturn: computePeriodReturn(s.item.prices),
    volatility: computeVolatility(s.item.prices),
  }));

  // 4) Compute weights
  let weights: number[];
  switch (config.weighting) {
    case "equal":
      weights = picksInit.map(() => 1 / picksInit.length);
      break;
    case "mcap": {
      const totalCap = topN.reduce((a, b) => a + b.item.marketCap, 0);
      weights = topN.map((s) => (totalCap > 0 ? s.item.marketCap / totalCap : 1 / picksInit.length));
      break;
    }
    case "invvol":
      weights = invVolWeights(picksInit);
      break;
  }
  const picks = picksInit.map((p, i) => ({ ...p, weight: weights[i] }));

  // 5) Portfolio return (weighted average of period returns)
  const portfolioReturn = picks.reduce((a, p) => a + p.weight * p.periodReturn, 0);

  // 6) Benchmark = equal-weighted universe return
  const benchmarkReturn =
    filtered.reduce((a, u) => a + computePeriodReturn(u.prices), 0) / filtered.length;

  // 7) Portfolio volatility (weighted average of individual vols — simplified, ignores correlation)
  const portfolioVol = picks.reduce((a, p) => a + p.weight * p.volatility, 0);

  // 8) Sector allocation
  const sectorMap = new Map<string, number>();
  for (const p of picks) {
    sectorMap.set(p.sector, (sectorMap.get(p.sector) ?? 0) + p.weight);
  }
  const sectorAllocation = Array.from(sectorMap.entries())
    .map(([sector, weight]) => ({ sector, weight }))
    .sort((a, b) => b.weight - a.weight);

  // 9) Best/worst
  const byReturn = [...picks].sort((a, b) => b.periodReturn - a.periodReturn);

  // Date range from first pick with prices (all should share it in the current cache)
  const firstPrices = topN[0]?.item.prices ?? [];
  const dateStart = firstPrices[0]?.date ?? "";
  const dateEnd = firstPrices[firstPrices.length - 1]?.date ?? "";
  const nPeriods = firstPrices.length;

  return {
    picks,
    portfolioReturn,
    benchmarkReturn,
    excessReturn: portfolioReturn - benchmarkReturn,
    volatility: portfolioVol,
    bestPick: byReturn[0] ?? null,
    worstPick: byReturn[byReturn.length - 1] ?? null,
    sectorAllocation,
    universeSize: filtered.length,
    dateStart,
    dateEnd,
    n_periods: nPeriods,
  };
}

function emptyResult(): BacktestResult {
  return {
    picks: [],
    portfolioReturn: 0,
    benchmarkReturn: 0,
    excessReturn: 0,
    volatility: 0,
    bestPick: null,
    worstPick: null,
    sectorAllocation: [],
    universeSize: 0,
    dateStart: "",
    dateEnd: "",
    n_periods: 0,
  };
}
