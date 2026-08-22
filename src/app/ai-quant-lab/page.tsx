import { redirect } from "next/navigation";

// Consolidated into /backtest (tab: AI 앙상블).
export default function AiQuantLabRedirect() {
  redirect("/backtest?tab=ml");
}
