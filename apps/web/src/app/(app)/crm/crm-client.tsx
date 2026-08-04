"use client";

import { useState } from "react";
import { Plus, Loader2, HeartHandshake, ArrowRightCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  useClients,
  useConvertLead,
  useCreateDeal,
  useCreateLead,
  useDeals,
  useLeads,
  useUpdateDeal,
  type DealRow,
  type LeadRow,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const STAGES = [
  { key: "qualification", label: "Qualification" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
] as const;

type Stage = (typeof STAGES)[number]["key"];

const leadStatusVariant = {
  new: "primary",
  contacted: "neutral",
  qualified: "success",
  converted: "success",
  lost: "danger",
} as const;

function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", company: "", email: "", source: "referral" });
  const createLead = useCreateLead();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createLead.mutate(
      { ...form, company: form.company || undefined, email: form.email || undefined },
      {
        onSuccess: () => {
          setForm({ name: "", company: "", email: "", source: "referral" });
          setOpen(false);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add lead."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Add lead
        </Button>
      </DialogTrigger>
      <DialogContent title="Add lead">
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Contact name</Label>
            <Input id="lead-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-company">Company</Label>
              <Input id="lead-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-source">Source</Label>
              <Select id="lead-source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                <option value="referral">Referral</option>
                <option value="website">Website</option>
                <option value="social">Social</option>
                <option value="cold">Cold outreach</option>
                <option value="event">Event</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lead-email">Email</Label>
            <Input id="lead-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <Button className="w-full" type="submit" disabled={createLead.isPending}>
            {createLead.isPending && <Loader2 className="animate-spin" />}
            Add lead
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConvertLeadDialog({ lead }: { lead: LeadRow }) {
  const [open, setOpen] = useState(false);
  const [dealTitle, setDealTitle] = useState("");
  const [dealValue, setDealValue] = useState("");
  const convert = useConvertLead();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ArrowRightCircle /> Convert
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Convert · ${lead.name}`}
        description="Creates a client record. Optionally open the first deal on the pipeline."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal-title">First deal (optional)</Label>
            <Input id="deal-title" value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} placeholder="Fleet onboarding" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deal-value">Deal value (₦)</Label>
            <Input id="deal-value" type="number" min="0" value={dealValue} onChange={(e) => setDealValue(e.target.value)} placeholder="0" />
          </div>
          <Button
            className="w-full"
            disabled={convert.isPending}
            onClick={() =>
              convert.mutate(
                {
                  id: lead.id,
                  dealTitle: dealTitle || undefined,
                  dealValue: dealValue ? Number(dealValue) : undefined,
                },
                { onSuccess: () => setOpen(false) },
              )
            }
          >
            {convert.isPending && <Loader2 className="animate-spin" />}
            Convert to client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewDealDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [clientId, setClientId] = useState("");
  const { data: clients } = useClients();
  const createDeal = useCreateDeal();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New deal
        </Button>
      </DialogTrigger>
      <DialogContent title="New deal" description="Starts in Qualification — drag it along the pipeline.">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="deal-title2">Title</Label>
            <Input id="deal-title2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Annual support contract" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deal-value2">Value (₦)</Label>
              <Input id="deal-value2" type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deal-client">Client</Label>
              <Select id="deal-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">No client yet</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={createDeal.isPending || !title}
            onClick={() =>
              createDeal.mutate(
                { title, value: value ? Number(value) : 0, client_id: clientId ? Number(clientId) : undefined },
                { onSuccess: () => { setTitle(""); setValue(""); setClientId(""); setOpen(false); } },
              )
            }
          >
            {createDeal.isPending && <Loader2 className="animate-spin" />}
            Create deal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Pipeline() {
  const { data, isPending } = useDeals();
  const updateDeal = useUpdateDeal();
  const [dragOver, setDragOver] = useState<Stage | null>(null);

  const byStage = (stage: Stage) =>
    (data?.deals ?? []).filter((d) => d.stage === stage).sort((a, b) => a.position - b.position);

  const handleDrop = (stage: Stage) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData("text/deal-id"));
    const deal = data?.deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    updateDeal.mutate({ id, stage, position: byStage(stage).length + 1 });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {STAGES.map((stage) => {
        const items = byStage(stage.key);
        const stat = data?.stats[stage.key];
        return (
          <div
            key={stage.key}
            onDragOver={(e) => { e.preventDefault(); setDragOver(stage.key); }}
            onDragLeave={() => setDragOver((prev) => (prev === stage.key ? null : prev))}
            onDrop={handleDrop(stage.key)}
            className={cn(
              "flex min-h-[300px] flex-col rounded-[14px] border border-border bg-muted/40 p-3 transition-colors",
              dragOver === stage.key && "border-primary/50 bg-primary/5",
            )}
          >
            <div className="mb-3 px-1">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">{stage.label}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                {formatCurrency(stat?.value ?? 0)}
              </p>
            </div>

            <div className="flex-1 space-y-2.5">
              {isPending && <Skeleton className="h-[76px] rounded-[12px]" />}
              {items.map((deal: DealRow) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/deal-id", String(deal.id))}
                  className="cursor-grab rounded-[12px] border border-border bg-surface p-3 shadow-card transition-all duration-150 hover:shadow-pop active:rotate-[0.6deg]"
                >
                  <p className="text-sm font-medium leading-snug">{deal.title}</p>
                  <p className="mt-1 text-[13px] font-semibold tabular-nums text-primary">
                    {formatCurrency(deal.value)}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="truncate text-[12px] text-muted-foreground">
                      {deal.client?.name ?? "No client"}
                    </span>
                    {deal.owner && <Avatar name={deal.owner} size={20} />}
                  </div>
                </div>
              ))}
              {!isPending && items.length === 0 && (
                <p className="px-1 py-4 text-center text-[12px] text-muted-foreground/70">Drop deals here</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Leads() {
  const { data: leads, isPending } = useLeads();

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr><td colSpan={6} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td></tr>
            )}
            {leads?.map((lead) => (
              <tr key={lead.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={lead.name} size={30} />
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-[12px] text-muted-foreground">{lead.email ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">{lead.company ?? "—"}</td>
                <td className="px-4 py-2.5 capitalize text-muted-foreground">{lead.source ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={leadStatusVariant[lead.status]}>{lead.status}</Badge>
                </td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatDate(lead.created_at)}</td>
                <td className="px-4 py-2.5 text-right">
                  {lead.status !== "converted" ? (
                    <ConvertLeadDialog lead={lead} />
                  ) : (
                    <span className="text-[13px] text-muted-foreground">Converted</span>
                  )}
                </td>
              </tr>
            ))}
            {!isPending && leads?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-[13px] text-muted-foreground">
                  No leads yet — add your first prospect.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Clients() {
  const { data: clients, isPending } = useClients();

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Deals</th>
              <th className="px-4 py-3">Pipeline value</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr><td colSpan={5} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td></tr>
            )}
            {clients?.map((client) => (
              <tr key={client.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={client.name} size={30} />
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-[12px] text-muted-foreground">{client.email ?? "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">{client.company ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{client.owner ?? "—"}</td>
                <td className="px-4 py-2.5 tabular-nums">{client.deals_count}</td>
                <td className="px-4 py-2.5 font-medium tabular-nums">{formatCurrency(client.pipeline_value)}</td>
              </tr>
            ))}
            {!isPending && clients?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-14 text-center text-[13px] text-muted-foreground">
                  No clients yet — convert a lead to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function CrmClient() {
  const [tab, setTab] = useState<"pipeline" | "leads" | "clients">("pipeline");
  const { data, isError } = useDeals();

  if (isError) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">CRM</h1>
        <Card>
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
              <HeartHandshake className="size-5 text-primary" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-medium">CRM access is limited</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Ask your admin for the CRM role if you work with leads and deals.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const totalOpen = ["qualification", "proposal", "negotiation"].reduce(
    (sum, s) => sum + (data?.stats[s]?.value ?? 0),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">CRM</h1>
          <Badge variant="primary">Open pipeline · {formatCurrency(totalOpen)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <NewLeadDialog />
          <NewDealDialog />
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {(["pipeline", "leads", "clients"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative px-3 py-2 text-sm capitalize transition-colors",
              tab === t ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "pipeline" && <Pipeline />}
      {tab === "leads" && <Leads />}
      {tab === "clients" && <Clients />}
    </div>
  );
}
