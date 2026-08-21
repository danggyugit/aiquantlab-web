import { cn } from "@/lib/utils";

type WatchlistRowProps = {
  rank: number;
  primary: string;
  secondary?: string;
  price: string;
  changePct: number;
  changeLabel?: string;
};

export function WatchlistRow({
  rank,
  primary,
  secondary,
  price,
  changePct,
  changeLabel,
}: WatchlistRowProps) {
  const isUp = changePct >= 0;
  const arrow = isUp ? "▲" : "▼";
  const changeColor = isUp ? "text-success" : "text-destructive";

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 px-2 py-4 transition-colors hover:bg-muted/30">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60 text-[10px] font-semibold text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{primary}</div>
          {secondary && (
            <div className="truncate text-xs text-muted-foreground">{secondary}</div>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums text-foreground">{price}</div>
        <div className={cn("flex items-center justify-end gap-1 text-xs font-medium tabular-nums", changeColor)}>
          <span>{arrow}</span>
          <span>{Math.abs(changePct).toFixed(2)}%</span>
          {changeLabel && <span className="ml-1 text-[10px] text-muted-foreground">{changeLabel}</span>}
        </div>
      </div>
    </div>
  );
}
