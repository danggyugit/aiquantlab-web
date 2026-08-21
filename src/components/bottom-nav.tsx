"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Grid2X2, Home, Menu, Sparkles, Star } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const PRIMARY = [
  { href: "/", label: "홈", icon: Home },
  { href: "/heatmap", label: "히트맵", icon: Grid2X2 },
  { href: "/watchlist", label: "관심", icon: Star },
  { href: "/ai-quant-lab", label: "AI", icon: Sparkles, premium: true },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav
      aria-label="Primary navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/60",
        "bg-background/85 backdrop-blur-md",
        "pb-[env(safe-area-inset-bottom)]",
        "lg:hidden",
      )}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1.5">
        {PRIMARY.map(({ href, label, icon: Icon, premium }) => {
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
        <li className="flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(
                "flex w-full flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium",
                "text-muted-foreground hover:text-foreground",
              )}
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} />
              <span>더보기</span>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 overflow-y-auto p-0">
              <SheetHeader className="border-b border-border/60 px-4 py-3">
                <SheetTitle>전체 메뉴</SheetTitle>
              </SheetHeader>
              <div className="px-2 py-3">
                {NAV_SECTIONS.map((section) => (
                  <div key={section.label} className="mb-4">
                    <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {section.label}
                    </div>
                    <ul className="flex flex-col gap-0.5">
                      {section.items.map((item) => {
                        const active =
                          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                                active
                                  ? "bg-primary/15 font-semibold text-primary"
                                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                                item.premium && active && "text-premium",
                              )}
                            >
                              <item.icon
                                className={cn("h-4 w-4 shrink-0", item.premium && "text-premium")}
                              />
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.premium && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 bg-premium/20 px-1.5 text-[9px] text-premium"
                                >
                                  PRO
                                </Badge>
                              )}
                              {item.wip && (
                                <Badge
                                  variant="secondary"
                                  className="h-5 bg-amber-500/20 px-1.5 text-[9px] text-amber-400"
                                >
                                  WIP
                                </Badge>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
