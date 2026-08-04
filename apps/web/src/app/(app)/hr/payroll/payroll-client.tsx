"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Loader2, Download, Banknote, CheckCircle2, Send, SlidersHorizontal, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  useAdjustPayrollItem,
  useBootstrap,
  useBankExport,
  useCreatePayrollRun,
  useMyPayslips,
  usePayrollAction,
  usePayrollRun,
  usePayrollRuns,
  type PayrollItemRow,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const statusVariant = { draft: "neutral", approved: "warning", published: "success" } as const;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function NewRunDialog() {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [error, setError] = useState<string | null>(null);
  const createRun = useCreatePayrollRun();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createRun.mutate(period, {
      onSuccess: () => setOpen(false),
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create run."),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New payroll run
        </Button>
      </DialogTrigger>
      <DialogContent
        title="New payroll run"
        description="Drafts one line per active employee with a salary, using the tax table for that year."
      >
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="period">Period</Label>
            <Input id="period" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
          </div>
          <Button className="w-full" type="submit" disabled={createRun.isPending}>
            {createRun.isPending && <Loader2 className="animate-spin" />}
            Draft run
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


function AdjustItemDialog({ runId, item }: { runId: number; item: PayrollItemRow }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bonus, setBonus] = useState(String(Object.values(item.bonuses ?? {})[0] ?? ""));
  const [deduction, setDeduction] = useState(String(Object.values(item.deductions ?? {})[0] ?? ""));
  const adjust = useAdjustPayrollItem();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    adjust.mutate(
      {
        runId,
        itemId: item.id,
        bonuses: Number(bonus) > 0 ? { bonus: Number(bonus) } : {},
        deductions: Number(deduction) > 0 ? { deduction: Number(deduction) } : {},
      },
      {
        onSuccess: () => setOpen(false),
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not adjust item."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Adjust ${item.employee}`}>
          <SlidersHorizontal />
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Adjust · ${item.employee}`}
        description="Bonuses are taxed; deductions (loans, advances) come off after tax. PAYE and totals recompute on save."
      >
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bonus">Bonus (₦)</Label>
              <Input id="bonus" type="number" min="0" step="1000" value={bonus} onChange={(e) => setBonus(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deduction">Deduction (₦)</Label>
              <Input id="deduction" type="number" min="0" step="1000" value={deduction} onChange={(e) => setDeduction(e.target.value)} placeholder="0" />
            </div>
          </div>
          <Button className="w-full" type="submit" disabled={adjust.isPending}>
            {adjust.isPending && <Loader2 className="animate-spin" />}
            Save adjustments
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollClient() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: runs, isPending: runsLoading, isError: runsError } = usePayrollRuns();
  const { data: detail, isPending: detailLoading } = usePayrollRun(selectedId);
  const { data: payslips } = useMyPayslips();
  const action = usePayrollAction();
  const { data: session } = useBootstrap();
  const canRunPayroll =
    (session?.permissions ?? []).includes("*") ||
    (session?.permissions ?? []).includes("hr.payroll.manage");
  const bankExport = useBankExport();

  const exportBank = (id: number, period: string) =>
    bankExport.mutate(id, {
      onSuccess: (rows) => downloadCsv(`bank-transfer-${period}.csv`, rows),
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Payroll</h1>
        <NewRunDialog />
      </div>

      {canRunPayroll ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-[13px] text-muted-foreground">
            A run covers everyone with a basic salary on their record. Set salaries and
            allowances on the employee.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/hr/employees">Open employees</Link>
          </Button>
        </Card>
      ) : null}

      {/* Runs list */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Payroll runs</CardTitle>
          <CardDescription>Draft → approve → publish. Published runs unlock payslips and bank export.</CardDescription>
        </CardHeader>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Employees</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Net</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runsLoading &&
                [1, 2].map((i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {runs?.map((run) => (
                <tr
                  key={run.id}
                  onClick={() => setSelectedId(run.id === selectedId ? null : run.id)}
                  className={`cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50 ${
                    selectedId === run.id ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-2.5 font-medium tabular-nums">{run.period}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{run.employees ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatCurrency(run.gross_total)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{formatCurrency(run.net_total)}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant[run.status]}>{run.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex gap-2">
                      {run.status === "draft" && (
                        <Button
                          size="sm"
                          disabled={action.isPending}
                          onClick={() => action.mutate({ id: run.id, action: "approve" })}
                        >
                          <CheckCircle2 /> Approve
                        </Button>
                      )}
                      {run.status === "approved" && (
                        <Button
                          size="sm"
                          disabled={action.isPending}
                          onClick={() => action.mutate({ id: run.id, action: "publish" })}
                        >
                          <Send /> Publish
                        </Button>
                      )}
                      {run.status === "published" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={bankExport.isPending}
                          onClick={() => exportBank(run.id, run.period)}
                        >
                          <Download /> Bank CSV
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!runsLoading && !runsError && runs?.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
                        <Banknote className="size-5 text-primary" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">No payroll runs yet</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          Draft your first run — PAYE and pension are computed automatically.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {runsError && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                    You don&apos;t have access to payroll, or it failed to load.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Run detail */}
      {selectedId !== null && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Run detail · {detail?.period ?? "…"}</CardTitle>
            <CardDescription>Per-employee breakdown: gross → pension → PAYE → net</CardDescription>
          </CardHeader>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Basic</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Pension (8%)</th>
                  <th className="px-4 py-3">PAYE</th>
                  <th className="px-4 py-3">Net</th>
                  <th className="px-4 py-3 text-right"><span className="sr-only">Adjust</span></th>
                </tr>
              </thead>
              <tbody>
                {detailLoading && (
                  <tr>
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-16 w-full" />
                    </td>
                  </tr>
                )}
                {detail?.items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{item.employee}</p>
                      <p className="text-[12px] text-muted-foreground">{item.employee_code}</p>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{formatCurrency(item.basic)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatCurrency(item.gross)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {formatCurrency(item.pension_employee)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatCurrency(item.paye_tax)}</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums">{formatCurrency(item.net)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {detail?.status === "draft" && <AdjustItemDialog runId={detail.id} item={item} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* My payslips */}
      <Card>
        <CardHeader>
          <CardTitle>My payslips</CardTitle>
          <CardDescription>Your published payslips, newest first</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 pt-3">
          {payslips?.map((slip) => (
            <div key={slip.id} className="flex items-center gap-3 rounded-[10px] p-2.5 transition-colors hover:bg-muted">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-muted">
                <Banknote className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tabular-nums">{slip.period}</p>
                <p className="text-[12px] text-muted-foreground">
                  Gross {formatCurrency(slip.gross)} · PAYE {formatCurrency(slip.paye_tax)} · Pension{" "}
                  {formatCurrency(slip.pension_employee)}
                </p>
              </div>
              <p className="font-semibold tabular-nums">{formatCurrency(slip.net)}</p>
              {slip.has_payslip && (
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/backend/hr/payslips/${slip.id}/download`} download>
                    <FileText /> PDF
                  </a>
                </Button>
              )}
            </div>
          ))}
          {payslips?.length === 0 && (
            <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
              Payslips appear here once a payroll run that includes you is published.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
