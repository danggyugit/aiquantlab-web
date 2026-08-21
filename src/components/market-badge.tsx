import { cn } from "@/lib/utils";

type MarketState = "open" | "closed" | "pre" | "after";

const LABEL: Record<MarketState, string> = {
  open: "Market Open",
  closed: "Market Closed",
  pre: "Pre-Market",
  after: "After Hours",
};

/**
 * Derive US market state (NY hours 9:30-16:00 ET, Mon-Fri).
 * Mirrors streamlit_app/components/ui.py:market_status(). EDT offset -4.
 */
function getMarketState(now: Date = new Date()): MarketState {
  const ny = new Date(now.getTime() + (-4 - now.getTimezoneOffset() / 60) * 60 * 60 * 1000);
  const weekday = ny.getUTCDay();
  const minutes = ny.getUTCHours() * 60 + ny.getUTCMinutes();
  if (weekday === 0 || weekday === 6) return "closed";
  if (minutes >= 570 && minutes < 960) return "open";
  if (minutes < 570) return "pre";
  return "after";
}

export function MarketBadge({ className }: { className?: string }) {
  const state = getMarketState();
  const isOpen = state === "open";
  const color = isOpen
    ? "bg-success/15 text-success border-success/40"
    : "bg-destructive/15 text-destructive border-destructive/40";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        color,
        className,
      )}
    >
      <span
        className="h-2 w-2 rounded-full bg-current"
        style={{ animation: "aiql-pulse 2s ease-in-out infinite" }}
      />
      {LABEL[state]}
    </span>
  );
}
