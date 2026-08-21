import type { BacktestConfig, BacktestPreset } from "@/lib/data";

/**
 * Streamlit `factor_backtest_service`는 브라우저에서 실행 불가 (yfinance·SEC·ML 학습).
 * 대신 stock-dashboard 스케줄러가 매일 5개 대표 프리셋을 미리 계산해두고 있음.
 * 사용자가 config 폼에서 조합을 만들면, 아래 5개 중 **가장 가까운 프리셋**을 매칭해 로드.
 *
 * 매칭 우선순위:
 *   1. cash_strategy 정확히 일치 → +5점
 *   2. use_ensemble 일치 → +3점
 *   3. use_inv_vol_weight 일치 → +2점
 *   4. use_momentum_weight 일치 → +2점
 *   5. use_mom_filter 일치 → +1점
 * 나머지 (universe·리밸런싱 주기·롤링윈도우 등)은 프리셋 간 차이 없음.
 */
export function findClosestPreset(
  userConfig: Partial<BacktestConfig>,
  presets: BacktestPreset[],
): { preset: BacktestPreset; score: number; exact: boolean } {
  let best = presets[0];
  let bestScore = -Infinity;

  for (const p of presets) {
    let score = 0;
    const c = p.config;
    if (userConfig.cash_strategy === c.cash_strategy) score += 5;
    if (userConfig.use_ensemble === c.use_ensemble) score += 3;
    if (userConfig.use_inv_vol_weight === c.use_inv_vol_weight) score += 2;
    if (userConfig.use_momentum_weight === c.use_momentum_weight) score += 2;
    if (userConfig.use_mom_filter === c.use_mom_filter) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  // Exact match = all 5 strategy flags identical
  const c = best.config;
  const exact =
    userConfig.cash_strategy === c.cash_strategy &&
    userConfig.use_ensemble === c.use_ensemble &&
    userConfig.use_inv_vol_weight === c.use_inv_vol_weight &&
    userConfig.use_momentum_weight === c.use_momentum_weight &&
    userConfig.use_mom_filter === c.use_mom_filter;

  return { preset: best, score: bestScore, exact };
}

/** Default config matching Streamlit's common_config + strategy toggles. */
export const DEFAULT_CONFIG: BacktestConfig = {
  cap_tiers: ["Large Cap"],
  sectors: ["Information Technology"],
  rebal_m: 1,
  rolling_w: 12,
  n_stocks: 5,
  tc_pct: 0.3,
  min_dollar_vol: 10_000_000,
  use_next_open: true,
  use_surv_fix: true,
  use_ensemble: false,
  use_mom_filter: false,
  use_turnover_buffer: true,
  start: "2023-01-01T00:00:00",
  end: "2026-08-20T00:00:00",
  min_test: 5,
  use_inv_vol_weight: false,
  use_momentum_weight: false,
  cash_strategy: "none",
};
