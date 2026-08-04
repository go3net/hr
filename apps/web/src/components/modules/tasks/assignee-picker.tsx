"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { useUsers } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

/**
 * Multi-select over workspace members. Without this a task always fell to
 * whoever created it — the API defaults `assignee_ids` to the caller — so
 * work could be written down but never handed to anyone.
 */
export function AssigneePicker({
  value,
  onChange,
  label = "Assigned to",
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  label?: string;
}) {
  const { data: users, isPending } = useUsers();
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => (users ?? []).filter((u) => value.includes(u.id)),
    [users, value],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users ?? [];
    if (!q) return list;
    return list.filter(
      (u) => u.name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q),
    );
  }, [users, query]);

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-1.5">
      <span className="text-[13px] font-medium text-foreground">{label}</span>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 py-0.5 pl-0.5 pr-1.5 text-[13px]"
            >
              <Avatar name={u.name} size={20} />
              {u.name}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                aria-label={`Remove ${u.name}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-[10px] border border-border">
        <div className="relative border-b border-border">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            aria-label="Search people"
            className="h-9 w-full rounded-t-[10px] bg-transparent pl-8 pr-3 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:text-sm"
          />
        </div>

        <div className="max-h-40 overflow-y-auto p-1">
          {isPending && <p className="px-2 py-2 text-[13px] text-muted-foreground">Loading…</p>}
          {!isPending && matches.length === 0 && (
            <p className="px-2 py-2 text-[13px] text-muted-foreground">Nobody matches that.</p>
          )}
          {matches.map((u) => {
            const on = value.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors",
                  on ? "bg-primary/10" : "hover:bg-muted",
                )}
              >
                <Avatar name={u.name} size={24} />
                <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
                {on && <Check className="size-4 shrink-0 text-primary" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
