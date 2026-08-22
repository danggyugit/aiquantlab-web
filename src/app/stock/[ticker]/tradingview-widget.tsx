"use client";

import { useEffect, useRef } from "react";

/**
 * TradingView Advanced Chart widget embed. Loads the widget script on mount
 * and cleans it up on unmount. No API key required — free.
 * https://www.tradingview.com/widget/advanced-chart/
 */
export function TradingViewWidget({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const symbolRef = useRef<string>(symbol);
  symbolRef.current = symbol;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clean any prior widget content before injecting a new script (StrictMode
    // double-mounts, and the script tag itself renders into container).
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `NASDAQ:${symbolRef.current}`,
      interval: "D",
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      // Fallback: if NASDAQ prefix doesn't resolve, TradingView will show a
      // symbol search bar to the user rather than an error.
    });
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="h-[520px] w-full">
      <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}
