"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Search, Sun, Moon, Monitor, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useBootstrap } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const themes = [
  { key: "light", icon: Sun, label: "Light" },
  { key: "dark", icon: Moon, label: "Dark" },
  { key: "system", icon: Monitor, label: "System" },
] as const;

const subscribeNoop = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { data: session } = useBootstrap();
  const workspaceName = session?.tenant?.branding?.display_name ?? "Go3net Office";
  // Theme is only known client-side — render the switcher after hydration.
  const mounted = useSyncExternalStore(subscribeNoop, getTrue, getFalse);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/80 px-4 backdrop-blur-xl lg:gap-3 lg:px-6">
      <MobileNav />

      {/* The sidebar carries the workspace identity on desktop; on mobile it
          is hidden, so the topbar shows it instead. */}
      <span className="truncate text-[15px] font-semibold tracking-[-0.01em] lg:hidden">
        {workspaceName}
      </span>

      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
        <input
          placeholder="Search anything…  ⌘K"
          className="h-10 w-full rounded-[10px] border border-border bg-muted/60 pl-9 pr-3 text-base sm:h-9 sm:text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {mounted && (
          <div className="hidden items-center rounded-full border border-border bg-muted/60 p-0.5 sm:flex" role="radiogroup" aria-label="Theme">
            {themes.map((t) => (
              <button
                key={t.key}
                role="radio"
                aria-checked={theme === t.key}
                aria-label={`${t.label} theme`}
                onClick={() => setTheme(t.key)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full transition-colors",
                  theme === t.key
                    ? "bg-surface text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="size-4" strokeWidth={1.75} />
              </button>
            ))}
          </div>
        )}

        <NotificationBell />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="ml-1 flex items-center gap-2 rounded-[10px] p-1 transition-colors hover:bg-muted"
              aria-label="Account menu"
            >
              <Avatar name={session?.user.name ?? "…"} size={30} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-[220px] rounded-[12px] border border-border bg-surface-elevated p-1.5 shadow-pop"
            >
              <div className="px-2.5 py-2">
                <p className="text-sm font-medium">{session?.user.name}</p>
                <p className="text-[12px] text-muted-foreground">{session?.user.email}</p>
              </div>
              {/* The inline theme switcher is hidden on small screens, so
                  phones get the control here instead. */}
              {mounted && (
                <div className="px-2.5 py-1.5 sm:hidden">
                  <p className="pb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Theme
                  </p>
                  <div className="flex items-center gap-1" role="radiogroup" aria-label="Theme">
                    {themes.map((t) => (
                      <button
                        key={t.key}
                        role="radio"
                        aria-checked={theme === t.key}
                        aria-label={`${t.label} theme`}
                        onClick={() => setTheme(t.key)}
                        className={cn(
                          "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] border text-[13px] transition-colors",
                          theme === t.key
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <t.icon className="size-4" strokeWidth={1.75} />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                onSelect={signOut}
                className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-muted"
              >
                <LogOut className="size-4 text-muted-foreground" strokeWidth={1.75} />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
