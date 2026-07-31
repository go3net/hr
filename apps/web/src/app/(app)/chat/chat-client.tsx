"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Plus, Send, Loader2, Users2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  useBootstrap,
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
  useStartConversation,
  useUsers,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function timeOf(iso: string): string {
  const date = new Date(iso);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday
    ? date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NewChatDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"direct" | "group">("direct");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { data: users } = useUsers();
  const { data: session } = useBootstrap();
  const start = useStartConversation();

  const toggle = (id: number) =>
    setSelected((prev) =>
      type === "direct" ? [id] : prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = () => {
    setError(null);
    start.mutate(
      { type, user_ids: selected, name: type === "group" ? name : undefined },
      {
        onSuccess: (res) => {
          setOpen(false);
          setSelected([]);
          setName("");
          onCreated(res.data.id);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not start chat."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> New chat
        </Button>
      </DialogTrigger>
      <DialogContent title="Start a conversation">
        <div className="space-y-4">
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select id="type" value={type} onChange={(e) => { setType(e.target.value as "direct" | "group"); setSelected([]); }}>
                <option value="direct">Direct message</option>
                <option value="group">Group chat</option>
              </Select>
            </div>
            {type === "group" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Group name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Launch crew" />
              </div>
            )}
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {users
              ?.filter((u) => u.id !== session?.user.id)
              .map((u) => (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-muted"
                >
                  <input
                    type={type === "direct" ? "radio" : "checkbox"}
                    name="chat-user"
                    checked={selected.includes(u.id)}
                    onChange={() => toggle(u.id)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <Avatar name={u.name} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{u.name}</span>
                </label>
              ))}
          </div>

          <Button
            className="w-full"
            onClick={submit}
            disabled={start.isPending || selected.length === 0 || (type === "group" && !name)}
          >
            {start.isPending && <Loader2 className="animate-spin" />}
            Start chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChatClient() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const { data: session } = useBootstrap();
  const { data: conversations, isPending: listLoading } = useConversations();
  const { data: messages, isPending: messagesLoading } = useMessages(activeId);
  const sendMessage = useSendMessage(activeId);
  const markRead = useMarkConversationRead();
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = conversations?.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const openConversation = (id: number) => {
    setActiveId(id);
    markRead.mutate(id);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft("");
    sendMessage.mutate(body);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Chat</h1>
      </div>

      <Card className="grid min-h-[560px] grid-cols-1 overflow-hidden md:grid-cols-[300px_1fr]">
        {/* Conversation list */}
        <div className="flex flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Conversations</p>
            <NewChatDialog onCreated={openConversation} />
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {listLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="mb-1.5 h-14 w-full" />)}
            {conversations?.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-left transition-colors",
                  activeId === c.id ? "bg-primary/10" : "hover:bg-muted",
                )}
              >
                {c.type === "group" ? (
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-chart-2/15 text-chart-2">
                    <Users2 className="size-4" strokeWidth={1.75} />
                  </span>
                ) : (
                  <Avatar name={c.name} size={36} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", c.unread > 0 ? "font-semibold" : "font-medium")}>
                      {c.name}
                    </span>
                    {c.last_message && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeOf(c.last_message.at)}</span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] text-muted-foreground">
                      {c.last_message ? `${c.last_message.author?.split(" ")[0] ?? ""}: ${c.last_message.body}` : "No messages yet"}
                    </span>
                    {c.unread > 0 && (
                      <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {c.unread > 9 ? "9+" : c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
            {!listLoading && conversations?.length === 0 && (
              <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
                No conversations yet — start one.
              </p>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-h-[420px] flex-col">
          {!active && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
                <MessageSquare className="size-5 text-primary" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-medium">Pick a conversation</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Messages update automatically.</p>
              </div>
            </div>
          )}

          {active && (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                {active.type === "group" ? (
                  <span className="flex size-8 items-center justify-center rounded-full bg-chart-2/15 text-chart-2">
                    <Users2 className="size-4" strokeWidth={1.75} />
                  </span>
                ) : (
                  <Avatar name={active.name} size={32} />
                )}
                <div>
                  <p className="text-sm font-semibold">{active.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {active.participants.map((p) => p.name.split(" ")[0]).join(", ")}
                  </p>
                </div>
                {active.type === "group" && <Badge variant="neutral">{active.participants.length} members</Badge>}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {messagesLoading && [1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-2/3" />)}
                {messages?.map((m) => {
                  const mine = m.author_id === session?.user.id || m.author_id === -1;
                  return (
                    <div key={m.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                      {!mine && <Avatar name={m.author ?? "?"} size={26} />}
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-3.5 py-2",
                          mine
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-muted",
                        )}
                      >
                        {!mine && active.type === "group" && (
                          <p className="text-[11px] font-semibold text-primary">{m.author}</p>
                        )}
                        <p className="whitespace-pre-wrap text-sm leading-snug">{m.body}</p>
                        <p className={cn("mt-0.5 text-right text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {timeOf(m.at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form className="flex gap-2 border-t border-border p-3" onSubmit={submit}>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${active.name}…`}
                  aria-label="Message"
                  autoComplete="off"
                />
                <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
                  <Send />
                </Button>
              </form>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
