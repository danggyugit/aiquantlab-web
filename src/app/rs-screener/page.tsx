import { redirect } from "next/navigation";

// Consolidated into /screener (tab: RS 모멘텀).
export default function RsScreenerRedirect() {
  redirect("/screener?tab=rs");
}
