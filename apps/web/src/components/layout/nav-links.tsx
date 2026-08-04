"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

/**
 * Shared between the desktop sidebar and the mobile drawer so the two can
 * never drift apart. `onNavigate` lets the drawer close itself on tap.
 */
export function NavLinks({
  groups,
  onNavigate,
  compact = true,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-[10px] px-2.5 text-sm transition-colors duration-150",
                      // Touch targets need more height than a mouse does.
                      compact ? "h-9" : "h-11",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {active && <span className="absolute left-0 h-4 w-0.5 rounded-full bg-primary" />}
                    <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}
