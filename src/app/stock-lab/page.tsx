import { redirect } from "next/navigation";

export const metadata = {
  title: "Stock Lab · AI Quant Lab",
  description: "AI 종목 리포트 서비스 (외부 도메인)",
};

/**
 * Stock Lab is a separate service hosted on Cloudflare Pages.
 * Server-side redirect keeps the menu entry unified but avoids
 * duplicating the app UI. Uses a 302 (temporary) so we can migrate
 * back to first-party later without polluting caches/history.
 */
export default function StockLabPage() {
  redirect("https://aiquantlab-stocklab.pages.dev");
}
