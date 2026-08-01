"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, CheckCheck, CheckSquare, CalendarDays, Banknote, Info } from "lucide-react";
import { useMarkAllNotificationsRead, useNotifications } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const kindIcon = {
  task: CheckSquare,
  leave: CalendarDays,
  payroll: Banknote,
  system: Info,
} as const;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const { data } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const unread = data?.unread_count ?? 0;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative flex size-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="size-[18px]" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-surface">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-surface-elevated shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
              >
                <CheckCheck className="size-3.5" strokeWidth={1.75} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto p-1.5">
            {data?.notifications.map((n) => {
              const Icon = kindIcon[n.kind] ?? Info;
              return (
                <DropdownMenu.Item key={n.id} asChild>
                  <Link
                    href={n.url}
                    className="flex cursor-pointer items-start gap-3 rounded-[10px] px-2.5 py-2.5 outline-none data-[highlighted]:bg-muted"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px]",
                        n.read ? "bg-muted text-muted-foreground" : "bg-primary/12 text-primary",
                      )}
                    >
                      <Icon className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-[13px]", !n.read && "font-semibold")}>{n.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.at)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">{n.body}</span>
                    </span>
                    {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
                  </Link>
                </DropdownMenu.Item>
              );
            })}
            {data?.notifications.length === 0 && (
              <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                You&apos;re all caught up — nothing new here.
              </p>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
