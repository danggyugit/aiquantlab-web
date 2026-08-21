"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Star, Sparkles, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  premium?: boolean;
};

const ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/heatmap", label: "히트맵", icon: LayoutGrid },
  { href: "/watchlist", label: "관심", icon: Star },
  { href: "/ai-quant-lab", label: "AI", icon: Sparkles, premium: true },
  { href: "/screener", label: "스크리너", icon: LineChart },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/60",
        "bg-background/85 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        // Hide on tablet+ (we'll add a sidebar/topbar later for desktop)
        "lg:hidden",
      )}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {ITEMS.map(({ href, label, icon: Icon, premium }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  premium && active && "text-premium",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform group-hover:scale-105",
                    premium && "text-premium",
                  )}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
