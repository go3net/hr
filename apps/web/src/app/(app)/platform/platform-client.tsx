"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Building2,
  Globe2,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import {
  usePlatformSignups,
  usePlatformSummary,
  useWorkspaces,
  type WorkspaceRow,
} from "@/hooks/use-api";
import { WorkspaceDialog } from "./workspace-dialog";
import { STATUS_BADGE, naira } from "./shared";

const FILTERS = [
  { value: "", label: "All workspaces" },
  { value: "trial", label: "On trial" },
  { value: "active", label: "Paying" },
  { value: "past_due", label: "Past due" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Go3net Office seen as a business rather than as a workspace: who signed up,
 * who is paying, whose trial is about to lapse. Reads account and billing
 * facts only — a customer's employees, salaries and documents stay behind
 * their own tenant boundary, and this page cannot reach them.
 */
export function PlatformClient() {
  const { data: summary, isPending } = usePlatformSummary();
  const { data: signups } = usePlatformSignups();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data: workspaces, isPending: listPending } = useWorkspaces({ q: search, status });
  const [open, setOpen] = useState<WorkspaceRow | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em]">
          <Globe2 className="size-5 text-primary" strokeWidth={1.75} />
          Platform console
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Every company on Go3net Office — their plan, their trial and what they pay. Their staff
          records stay private to them.
        </p>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={Building2}
            label="Workspaces"
            value={String(summary.workspaces)}
            hint={`${summary.active} paying · ${summary.trialing} on trial`}
          />
          <Metric
            icon={TrendingUp}
            label="Revenue this month"
            value={naira.format(summary.revenue_this_month)}
            hint={`${naira.format(summary.revenue_all_time)} all time`}
          />
          <Metric
            icon={Users}
            label="People on the platform"
            value={String(summary.seats)}
            hint="Across every workspace"
          />
          <Metric
            icon={AlertTriangle}
            label="Trials to chase"
            value={String(summary.trials_ending_soon + summary.expired_trials)}
            hint={`${summary.trials_ending_soon} ending in 7 days · ${summary.expired_trials} lapsed`}
            urgent={summary.trials_ending_soon + summary.expired_trials > 0}
          />
        </div>
      ) : null}

      {signups?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>New companies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={signups} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--surface-elevated)",
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="signups" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Workspaces</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 sm:w-56"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44">
              {FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {listPending ? (
            <Skeleton className="h-56" />
          ) : !workspaces?.length ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">
              No workspace matches that.
            </p>
          ) : (
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[720px] whitespace-nowrap text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Company</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Plan</th>
                    <th className="py-2 pr-4 font-medium">People</th>
                    <th className="py-2 pr-4 font-medium">Paid</th>
                    <th className="py-2 pr-4 font-medium">Joined</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((w) => {
                    const badge = STATUS_BADGE[w.status] ?? { label: w.status, variant: "neutral" as const };
                    return (
                      <tr key={w.id} className="border-b border-border/60 last:border-0">
                        <td className="py-3 pr-4">
                          <p className="font-medium">{w.name}</p>
                          <p className="text-[12px] text-muted-foreground">{w.subdomain}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {w.status === "trial" && w.trial_days_left !== null && w.trial_days_left <= 7 ? (
                            <span className="ml-2 text-[12px] text-warning">
                              {w.trial_days_left < 0 ? "lapsed" : `${w.trial_days_left}d left`}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{w.plan_key ?? "—"}</td>
                        <td className="py-3 pr-4 tabular-nums">{w.headcount}</td>
                        <td className="py-3 pr-4 tabular-nums">{naira.format(w.paid_total)}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{w.created_at}</td>
                        <td className="py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => setOpen(w)}>
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {open ? <WorkspaceDialog row={open} onDone={() => setOpen(null)} /> : null}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  urgent,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  hint: string;
  urgent?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-[-0.02em]">{value}</p>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{hint}</p>
        </div>
        <span
          className={
            urgent
              ? "flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--warning-soft)] text-warning"
              : "flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-muted-foreground"
          }
        >
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
      </div>
    </Card>
  );
}
