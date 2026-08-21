import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type MetricCardProps = {
  label: string;
  value: string;
  change?: number;
  unit?: string;
  className?: string;
};

export function MetricCard({ label, value, change, unit, className }: MetricCardProps) {
  const isUp = change !== undefined && change >= 0;
  const changeColor = isUp ? "text-success" : "text-destructive";

  return (
    <div
      className={cn(
        "group rounded-xl border border-primary/15 bg-gradient-to-br from-card/60 to-background/40",
        "px-5 py-4 backdrop-blur-md transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_4px_20px_rgba(59,130,246,0.15)]",
        className,
      )}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className={cn("mt-1 flex items-center gap-1 text-sm font-medium", changeColor)}>
          {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
          <span className="tabular-nums">{Math.abs(change).toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}
