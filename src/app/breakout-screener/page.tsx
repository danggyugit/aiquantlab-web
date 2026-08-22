import { redirect } from "next/navigation";

// Consolidated into /screener (tab: 돌파).
export default function BreakoutScreenerRedirect() {
  redirect("/screener?tab=breakout");
}
