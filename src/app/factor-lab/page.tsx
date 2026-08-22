import { redirect } from "next/navigation";

// Consolidated into /backtest (tab: 룰 기반).
export default function FactorLabRedirect() {
  redirect("/backtest?tab=rule");
}
