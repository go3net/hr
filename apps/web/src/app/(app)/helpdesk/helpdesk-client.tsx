"use client";

import { useState } from "react";
import { LifeBuoy, Loader2, Lock, Plus, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  type TicketRow,
  useAddTicketComment,
  useBootstrap,
  useCreateTicket,
  useTicket,
  useTickets,
  useUpdateTicket,
  useUsers,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; variant: "primary" | "success" | "warning" | "danger" | "neutral" }> = {
  open: { label: "Open", variant: "warning" },
  in_progress: { label: "In progress", variant: "primary" },
  waiting: { label: "Waiting", variant: "neutral" },
  resolved: { label: "Resolved", variant: "success" },
  closed: { label: "Closed", variant: "neutral" },
};

const PRIORITY_META: Record<string, { label: string; variant: "primary" | "success" | "warning" | "danger" | "neutral" }> = {
  low: { label: "Low", variant: "neutral" },
  medium: { label: "Medium", variant: "primary" },
  high: { label: "High", variant: "warning" },
  urgent: { label: "Urgent", variant: "danger" },
};

const CATEGORIES = [
  { value: "it", label: "IT & equipment" },
  { value: "hr", label: "HR" },
  { value: "facilities", label: "Facilities" },
  { value: "finance", label: "Finance" },
  { value: "other", label: "Other" },
];

const FILTERS = ["all", "open", "in_progress", "waiting", "resolved", "closed"] as const;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NewTicketDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("it");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateTicket();

  const submit = () => {
    setError(null);
    create.mutate(
      { subject, description, priority, category },
      {
        onSuccess: (ticket) => {
          setOpen(false);
          setSubject("");
          setDescription("");
          onCreated(ticket.id);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create the ticket."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New ticket
        </Button>
      </DialogTrigger>
      <DialogContent title="New ticket" description="Tell us what you need help with.">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="t-subject">Subject</Label>
            <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Laptop will not boot" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-desc">Details</Label>
            <textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="What happened, and what have you tried?"
              className="w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-card focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="t-priority">Priority</Label>
              <Select id="t-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {Object.entries(PRIORITY_META).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-category">Category</Label>
              <Select id="t-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={create.isPending || subject.trim() === "" || description.trim() === ""}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Submit ticket
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TicketDetail({ ticketId, isAgent }: { ticketId: number; isAgent: boolean }) {
  const { data: session } = useBootstrap();
  const { data: ticket, isLoading } = useTicket(ticketId);
  const { data: users } = useUsers();
  const update = useUpdateTicket();
  const comment = useAddTicketComment(ticketId);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);

  if (isLoading || !ticket) {
    return (
      <Card className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  }

  const mine = ticket.requester_id === session?.user.id;
  const closable = mine && !isAgent && ticket.status !== "closed";

  const send = () => {
    if (reply.trim() === "") return;
    comment.mutate(
      { body: reply, is_internal: internal },
      { onSuccess: () => { setReply(""); setInternal(false); } },
    );
  };

  return (
    <Card className="flex h-full flex-col">
      <div className="border-b border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{ticket.number}</p>
            <h2 className="text-[15px] font-semibold text-foreground">{ticket.subject}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {ticket.requester} · {timeOf(ticket.created_at)}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant={STATUS_META[ticket.status].variant}>{STATUS_META[ticket.status].label}</Badge>
            <Badge variant={PRIORITY_META[ticket.priority].variant}>{PRIORITY_META[ticket.priority].label}</Badge>
          </div>
        </div>

        {isAgent ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Select
              aria-label="Status"
              value={ticket.status}
              onChange={(e) => update.mutate({ id: ticket.id, status: e.target.value })}
            >
              {Object.entries(STATUS_META).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </Select>
            <Select
              aria-label="Priority"
              value={ticket.priority}
              onChange={(e) => update.mutate({ id: ticket.id, priority: e.target.value })}
            >
              {Object.entries(PRIORITY_META).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </Select>
            <Select
              aria-label="Assignee"
              value={ticket.assignee_id ?? ""}
              onChange={(e) =>
                update.mutate({ id: ticket.id, assignee_id: e.target.value === "" ? null : Number(e.target.value) })
              }
            >
              <option value="">Unassigned</option>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </div>
        ) : closable ? (
          <div className="mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => update.mutate({ id: ticket.id, status: "closed" })}
              disabled={update.isPending}
            >
              Close ticket
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-5">
        <div className="rounded-[10px] bg-muted/40 p-3 text-sm text-foreground">
          <p className="whitespace-pre-wrap">{ticket.description}</p>
        </div>
        {ticket.comments.map((c) => (
          <div
            key={c.id}
            className={cn(
              "rounded-[10px] border p-3 text-sm",
              c.is_internal
                ? "border-warning/40 bg-[var(--warning-soft,rgba(245,158,11,0.08))]"
                : "border-border bg-surface",
            )}
          >
            <div className="mb-1 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="font-medium text-foreground">{c.author}</span>
              {c.is_internal ? (
                <span className="inline-flex items-center gap-1"><Lock className="size-3" /> Internal note</span>
              ) : null}
              <span>{timeOf(c.at)}</span>
            </div>
            <p className="whitespace-pre-wrap text-foreground">{c.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "closed" ? (
        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              rows={2}
              placeholder={internal ? "Internal note (hidden from the requester)…" : "Write a reply…"}
              className={cn(
                "min-h-11 flex-1 resize-none rounded-[10px] border bg-surface px-3 py-2 text-sm text-foreground shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                internal ? "border-warning/50" : "border-border focus-visible:border-primary",
              )}
            />
            <Button size="icon" aria-label="Send reply" onClick={send} disabled={comment.isPending || reply.trim() === ""}>
              {comment.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          {isAgent ? (
            <label className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
                className="size-3.5 accent-[var(--warning,#F59E0B)]"
              />
              Internal note
            </label>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function HelpdeskClient() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [selected, setSelected] = useState<number | null>(null);
  const { data, isLoading } = useTickets(filter === "all" ? undefined : filter);

  const tickets = data?.tickets ?? [];
  const isAgent = data?.isAgent ?? false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Help desk</h1>
          <p className="text-sm text-muted-foreground">
            {isAgent ? "All tickets across the workspace." : "Your support requests."}
          </p>
        </div>
        <NewTicketDialog onCreated={setSelected} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-[13px] transition",
              filter === f
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {f === "all" ? "All" : STATUS_META[f].label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-2">
          {isLoading ? (
            <>
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </>
          ) : tickets.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LifeBuoy className="size-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                {filter === "all" ? "No tickets yet — open one when you need a hand." : "Nothing with this status."}
              </p>
            </Card>
          ) : (
            tickets.map((t: TicketRow) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                className={cn(
                  "w-full rounded-[14px] border bg-surface p-4 text-left shadow-card transition hover:border-primary/40",
                  selected === t.id ? "border-primary/50 ring-1 ring-primary/30" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{t.number}</span>
                  <div className="flex gap-1.5">
                    <Badge variant={STATUS_META[t.status].variant}>{STATUS_META[t.status].label}</Badge>
                    <Badge variant={PRIORITY_META[t.priority].variant}>{PRIORITY_META[t.priority].label}</Badge>
                  </div>
                </div>
                <p className="mt-1.5 truncate text-sm font-medium text-foreground">{t.subject}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {isAgent ? `${t.requester} · ` : ""}
                  {t.assignee ? `Assigned to ${t.assignee}` : "Unassigned"} · {timeOf(t.created_at)}
                </p>
              </button>
            ))
          )}
        </div>

        {selected !== null ? (
          <TicketDetail ticketId={selected} isAgent={isAgent} />
        ) : (
          <Card className="hidden items-center justify-center p-10 text-sm text-muted-foreground xl:flex">
            Select a ticket to see the conversation.
          </Card>
        )}
      </div>
    </div>
  );
}
