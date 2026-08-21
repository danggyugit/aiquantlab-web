"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        "hidden lg:flex",
        "fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-border/60 bg-background/80 backdrop-blur",
        "overflow-y-auto",
      )}
    >
      <div className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-premium text-sm font-bold text-primary-foreground">
            Q
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold">AI Quant Lab</span>
            <span className="text-[10px] text-muted-foreground">미국 주식 리서치</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-2 pb-6">
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
                      aria-current={active ? "page" : undefined}
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
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.premium && (
                        <Badge variant="secondary" className="h-5 bg-premium/20 px-1.5 text-[9px] text-premium">
                          PRO
                        </Badge>
                      )}
                      {item.wip && (
                        <Badge variant="secondary" className="h-5 bg-amber-500/20 px-1.5 text-[9px] text-amber-400">
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
      </nav>
    </aside>
  );
}
