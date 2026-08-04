"use client";

import { useState } from "react";
import { Plus, Loader2, Wallet, Send, Banknote, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  useCreateInvoice,
  useCreateTransaction,
  useDecideTransaction,
  useFinanceSummary,
  useInvoices,
  useRecordPayment,
  useSendInvoice,
  useTransactions,
  type InvoiceRow,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const invoiceStatusVariant = {
  draft: "neutral",
  sent: "primary",
  partial: "warning",
  paid: "success",
  overdue: "danger",
} as const;

function NewTransactionDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    kind: "income",
    amount: "",
    description: "",
    occurred_on: new Date().toISOString().slice(0, 10),
  });
  const createTransaction = useCreateTransaction();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createTransaction.mutate(
      { ...form, amount: Number(form.amount) },
      {
        onSuccess: () => {
          setForm({ ...form, amount: "", description: "" });
          setOpen(false);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not record it."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> Record transaction
        </Button>
      </DialogTrigger>
      <DialogContent title="Record transaction" description="Expenses go to approval; income posts immediately.">
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-kind">Type</Label>
              <Select id="tx-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Amount (₦)</Label>
              <Input id="tx-amount" type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-desc">Description</Label>
            <Input id="tx-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Team offsite catering" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-date">Date</Label>
            <Input id="tx-date" type="date" value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} required />
          </div>
          <Button className="w-full" type="submit" disabled={createTransaction.isPending}>
            {createTransaction.isPending && <Loader2 className="animate-spin" />}
            Record
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type DraftItem = { description: string; quantity: string; unit_price: string };

function NewInvoiceDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taxRate, setTaxRate] = useState("7.5");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ description: "", quantity: "1", unit_price: "" }]);
  const createInvoice = useCreateInvoice();

  const setItem = (index: number, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const subtotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const total = subtotal * (1 + (Number(taxRate) || 0) / 100);

  const submit = () => {
    setError(null);
    createInvoice.mutate(
      {
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: dueDate || undefined,
        tax_rate: Number(taxRate) || 0,
        items: items
          .filter((i) => i.description && Number(i.unit_price) >= 0)
          .map((i) => ({ description: i.description, quantity: Number(i.quantity) || 1, unit_price: Number(i.unit_price) || 0 })),
      },
      {
        onSuccess: () => {
          setItems([{ description: "", quantity: "1", unit_price: "" }]);
          setOpen(false);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create invoice."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New invoice
        </Button>
      </DialogTrigger>
      <DialogContent title="New invoice" className="max-w-lg">
        <div className="space-y-4">
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Line items</Label>
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={item.description}
                  onChange={(e) => setItem(i, { description: e.target.value })}
                  placeholder="Description"
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={item.quantity}
                  onChange={(e) => setItem(i, { quantity: e.target.value })}
                  className="w-16 text-center"
                  aria-label="Quantity"
                />
                <Input
                  type="number"
                  min="0"
                  value={item.unit_price}
                  onChange={(e) => setItem(i, { unit_price: e.target.value })}
                  placeholder="₦"
                  className="w-28"
                  aria-label="Unit price"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove line"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((_, x) => x !== i))}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", unit_price: "" }])}>
              <Plus /> Add line
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-tax">Tax rate (%)</Label>
              <Input id="inv-tax" type="number" min="0" max="100" step="0.5" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-due">Due date</Label>
              <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[10px] bg-muted px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">Total incl. tax</span>
            <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
          </div>

          <Button className="w-full" onClick={submit} disabled={createInvoice.isPending || subtotal <= 0}>
            {createInvoice.isPending && <Loader2 className="animate-spin" />}
            Create draft invoice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({ invoice }: { invoice: InvoiceRow }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recordPayment = useRecordPayment();
  const remaining = invoice.total - invoice.paid_amount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Banknote /> Payment
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Record payment · ${invoice.number}`}
        description={`Outstanding: ${formatCurrency(remaining)}`}
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount received (₦)</Label>
            <Input id="pay-amount" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(remaining)} />
          </div>
          <Button
            className="w-full"
            disabled={recordPayment.isPending || !amount}
            onClick={() =>
              recordPayment.mutate(
                { id: invoice.id, amount: Number(amount), paid_on: new Date().toISOString().slice(0, 10) },
                {
                  onSuccess: () => { setAmount(""); setOpen(false); },
                  onError: (err) => setError(err instanceof ApiError ? err.message : "Could not record payment."),
                },
              )
            }
          >
            {recordPayment.isPending && <Loader2 className="animate-spin" />}
            Record payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FinanceClient() {
  const [tab, setTab] = useState<"overview" | "invoices">("overview");
  const { data: summary, isPending: summaryLoading, isError } = useFinanceSummary();
  const { data: transactions, isPending: txLoading } = useTransactions();
  const { data: invoices, isPending: invoicesLoading } = useInvoices();
  const decide = useDecideTransaction();
  const sendInvoice = useSendInvoice();

  if (isError) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Finance</h1>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-20 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
              <Wallet className="size-5 text-primary" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-medium">Finance access is limited</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Ask your admin for the Finance role.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = [
    { name: "Income this month", value: summary?.income ?? 0, tone: "text-success" },
    { name: "Expenses this month", value: summary?.expenses ?? 0, tone: "text-danger" },
    { name: "Net", value: summary?.net ?? 0, tone: (summary?.net ?? 0) >= 0 ? "text-success" : "text-danger" },
    { name: "Outstanding invoices", value: summary?.outstanding_invoices ?? 0, tone: "text-warning" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Finance</h1>
        <div className="flex items-center gap-2">
          <NewTransactionDialog />
          <NewInvoiceDialog />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-5">
              <p className="text-[13px] text-muted-foreground">{stat.name}</p>
              {summaryLoading ? (
                <Skeleton className="mt-2 h-8 w-28" />
              ) : (
                <p className={cn("mt-2 text-[22px] font-semibold tracking-[-0.02em] tabular-nums", stat.tone)}>
                  {formatCurrency(stat.value)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {(["overview", "invoices"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative px-3 py-2 text-sm capitalize transition-colors",
              tab === t ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "overview" ? "Transactions" : "Invoices"}
            {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {txLoading && (
                  <tr><td colSpan={5} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td></tr>
                )}
                {transactions?.map((t) => (
                  <tr key={t.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{t.description}</p>
                      <p className="text-[12px] text-muted-foreground">{t.created_by ?? ""}</p>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatDate(t.occurred_on)}</td>
                    <td className={cn("px-4 py-2.5 font-medium tabular-nums", t.kind === "income" ? "text-success" : "text-danger")}>
                      {t.kind === "income" ? "+" : "−"}{formatCurrency(t.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={t.status === "approved" ? "success" : t.status === "pending" ? "warning" : "danger"}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {t.status === "pending" ? (
                        <div className="inline-flex gap-2">
                          <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: t.id, decision: "reject" })}>
                            Reject
                          </Button>
                          <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: t.id, decision: "approve" })}>
                            Approve
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!txLoading && transactions?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center text-[13px] text-muted-foreground">
                      No transactions yet — record income or an expense.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "invoices" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoicesLoading && (
                  <tr><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td></tr>
                )}
                {invoices?.map((inv) => (
                  <tr key={inv.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium tabular-nums">{inv.number}</p>
                      <p className="text-[12px] text-muted-foreground">{inv.client ?? "No client"}</p>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatDate(inv.issue_date)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : "—"}</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatCurrency(inv.paid_amount)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={invoiceStatusVariant[inv.status]}>{inv.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-2">
                        {inv.status === "draft" && (
                          <Button size="sm" disabled={sendInvoice.isPending} onClick={() => sendInvoice.mutate(inv.id)}>
                            <Send /> Send
                          </Button>
                        )}
                        {(inv.status === "sent" || inv.status === "partial" || inv.status === "overdue") && (
                          <RecordPaymentDialog invoice={inv} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!invoicesLoading && invoices?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center text-[13px] text-muted-foreground">
                      No invoices yet — create your first one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
