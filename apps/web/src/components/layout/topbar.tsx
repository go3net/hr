"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Bell, Search, Sun, Moon, Monitor } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const themes = [
  { key: "light", icon: Sun, label: "Light" },
  { key: "dark", icon: Moon, label: "Dark" },
  { key: "system", icon: Monitor, label: "System" },
] as const;

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-xl lg:px-6">
      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
        <input
          placeholder="Search anything…  ⌘K"
          className="h-9 w-full rounded-[10px] border border-border bg-muted/60 pl-9 pr-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
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

        <button
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-surface" />
        </button>

        <button className="ml-1 flex items-center gap-2 rounded-[10px] p-1 transition-colors hover:bg-muted">
          <Avatar name="Adaeze Okafor" size={30} />
        </button>
      </div>
    </header>
  );
}
