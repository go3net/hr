"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  type AiChatMessage,
  useAiChat,
  useAiGenerate,
  useAiStatus,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<string, string> = {
  search_employees: "Employee directory",
  get_leave_summary: "Leave summary",
  get_attendance_today: "Attendance",
  get_project_status: "Projects",
  get_deal_pipeline: "Deal pipeline",
  get_finance_summary: "Finance",
};

const SUGGESTIONS: { tool: string; prompt: string }[] = [
  { tool: "get_leave_summary", prompt: "Who is on leave today?" },
  { tool: "get_attendance_today", prompt: "How is attendance looking today?" },
  { tool: "get_deal_pipeline", prompt: "How is the sales pipeline?" },
  { tool: "get_finance_summary", prompt: "Summarize this month's finances." },
  { tool: "get_project_status", prompt: "What projects are active right now?" },
  { tool: "search_employees", prompt: "How many active employees do we have?" },
];

const DOC_TYPES = [
  { value: "offer_letter", label: "Offer letter" },
  { value: "contract", label: "Contract" },
  { value: "policy", label: "Company policy" },
  { value: "memo", label: "Internal memo" },
  { value: "email", label: "Professional email" },
  { value: "other", label: "Other document" },
];

type ChatEntry = AiChatMessage & { toolCalls?: string[] };

function DraftDocumentDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("offer_letter");
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = useAiGenerate();

  const submit = () => {
    setError(null);
    setResult(null);
    generate.mutate(
      { type, instructions },
      {
        onSuccess: (res) => setResult(res.content),
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not generate the document."),
      },
    );
  };

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setResult(null); setError(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileText className="size-4" />
          Draft a document
        </Button>
      </DialogTrigger>
      <DialogContent title="Draft a document" className="max-w-2xl">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="doc-type">Document type</Label>
            <Select id="doc-type" value={type} onChange={(e) => setType(e.target.value)}>
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="doc-instructions">What should it say?</Label>
            <textarea
              id="doc-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="e.g. Offer letter for Adaeze Obi as Senior Engineer, ₦850,000 monthly, starting 1 September, hybrid in Lagos."
              className="w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-base text-foreground shadow-card sm:text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={generate.isPending || instructions.trim().length < 10}>
              {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Generate
            </Button>
          </div>
          {result ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Draft</p>
                <Button variant="ghost" size="sm" onClick={copy}>
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-[10px] border border-border bg-muted/40 p-4 font-sans text-sm text-foreground">
                {result}
              </pre>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AssistantClient() {
  const { data: status, isLoading } = useAiStatus();
  const chat = useAiChat();
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, chat.isPending]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || chat.isPending || !status?.configured) return;

    const next: ChatEntry[] = [...entries, { role: "user", content }];
    setEntries(next);
    setInput("");
    setError(null);

    // Send the last 20 turns as context; the server enforces its own cap.
    const history = next.slice(-20).map(({ role, content: c }) => ({ role, content: c }));
    chat.mutate(history, {
      onSuccess: (res) =>
        setEntries((prev) => [...prev, { role: "assistant", content: res.reply, toolCalls: res.tool_calls }]),
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "The assistant is unavailable right now."),
    });
  };

  const availableSuggestions = SUGGESTIONS.filter((s) => status?.tools.includes(s.tool));

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">AI assistant</h1>
          <p className="text-sm text-muted-foreground">
            Answers grounded in your workspace data — nothing is ever invented.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status?.configured ? (
            <Badge variant="neutral" className="hidden sm:inline-flex">{status.model}</Badge>
          ) : null}
          {status?.configured ? <DraftDocumentDialog /> : null}
        </div>
      </div>

      {isLoading ? (
        <Card className="flex-1 space-y-3 p-6">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/5" />
        </Card>
      ) : !status?.configured ? (
        <Card className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Assistant not configured yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Add <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">ANTHROPIC_API_KEY</code> to
            the API environment and the assistant will switch on for this workspace — grounded Q&A over your
            HR, project, CRM and finance data, plus document drafting.
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex-1 overflow-hidden">
            <div ref={scrollRef} className="h-full overflow-y-auto p-4 sm:p-6">
            {entries.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-7" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Ask about your workspace</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    I can look things up across the modules you have access to.
                  </p>
                </div>
                {availableSuggestions.length > 0 ? (
                  <div className="flex max-w-xl flex-wrap justify-center gap-2">
                    {availableSuggestions.map((s) => (
                      <button
                        key={s.tool}
                        type="button"
                        onClick={() => send(s.prompt)}
                        className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-foreground shadow-card transition hover:border-primary/40 hover:bg-primary/5"
                      >
                        {s.prompt}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                {entries.map((entry, i) => (
                  <div key={i} className={cn("flex", entry.role === "user" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        entry.role === "user"
                          ? "rounded-br-md bg-primary text-white"
                          : "rounded-bl-md border border-border bg-surface text-foreground shadow-card",
                      )}
                    >
                      <div className="whitespace-pre-wrap">{entry.content}</div>
                      {entry.toolCalls && entry.toolCalls.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
                          {entry.toolCalls.map((tool) => (
                            <span
                              key={tool}
                              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              <Wrench className="size-3" />
                              {TOOL_LABELS[tool] ?? tool}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
                {chat.isPending ? (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-2.5 text-sm text-muted-foreground shadow-card">
                      <Loader2 className="size-4 animate-spin" />
                      Looking that up…
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            </div>
          </Card>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask anything about your workspace…"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-[14px] border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-card focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" size="icon" disabled={chat.isPending || input.trim() === ""} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
