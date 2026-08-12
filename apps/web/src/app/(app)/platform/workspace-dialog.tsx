"use client";

import { useState } from "react";
import { CalendarClock, Loader2, Mail, PauseCircle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/input";
import { Dialog, DialogContent, Select } from "@/components/ui/dialog";
import { useUpdateWorkspace, useWorkspace, type WorkspaceRow } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { STATUS_BADGE, naira } from "./shared";

const PLANS = [
  { value: "", label: "No plan" },
  { value: "starter", label: "Starter" },
  { value: "growth", label: "Growth" },
  { value: "enterprise", label: "Enterprise" },
];

const EXTENSIONS = [7, 14, 30];

/**
 * One account, from the outside. Plan, trial, what they have paid and who to
 * contact — everything needed to run them as a customer, and nothing from
 * inside their workspace.
 */
export function WorkspaceDialog({ row, onDone }: { row: WorkspaceRow; onDone: () => void }) {
  const { data: detail, isPending } = useWorkspace(row.id);
  const update = useUpdateWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState(row.plan_key ?? "");

  const workspace = detail ?? row;
  const suspended = workspace.status === "suspended" || workspace.status === "cancelled";
  const badge = STATUS_BADGE[workspace.status] ?? { label: workspace.status, variant: "neutral" as const };

  const apply = (payload: { status?: string; plan_key?: string | null; extend_trial_days?: number }) => {
    setError(null);
    update.mutate(
      { id: row.id, ...payload },
      {
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not update this workspace."),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent
        title={workspace.name}
        description={`${workspace.subdomain}.go3net.app · joined ${workspace.created_at}`}
      >
        <div className="space-y-5">
          {error ? <p className="text-[13px] text-danger">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {workspace.plan_key ? <Badge variant="primary">{workspace.plan_key}</Badge> : null}
            {workspace.trial_days_left !== null && workspace.status === "trial" ? (
              <Badge variant={workspace.trial_days_left < 0 ? "danger" : "warning"}>
                {workspace.trial_days_left < 0
                  ? `Trial lapsed ${Math.abs(workspace.trial_days_left)}d ago`
                  : `${workspace.trial_days_left}d of trial left`}
              </Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="People" value={String(workspace.headcount)} />
            <Stat label="Logins" value={String(workspace.members_count)} />
            <Stat label="Paid" value={naira.format(workspace.paid_total)} />
          </div>

          {isPending ? (
            <Skeleton className="h-24" />
          ) : detail?.owner ? (
            <div className="rounded-[12px] border border-border p-3">
              <p className="text-[13px] font-medium">{detail.owner.name}</p>
              <a
                className="mt-0.5 flex items-center gap-1.5 text-[13px] text-primary hover:underline"
                href={`mailto:${detail.owner.email}`}
              >
                <Mail className="size-3.5" />
                {detail.owner.email}
              </a>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {detail.owner.last_login_at
                  ? `Last signed in ${new Date(detail.owner.last_login_at).toLocaleDateString()}`
                  : "Has not signed in yet"}
              </p>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="w-plan">Plan</Label>
            <div className="flex gap-2">
              <Select
                id="w-plan"
                className="flex-1"
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
              >
                {PLANS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
              <Button
                variant="outline"
                disabled={update.isPending || plan === (workspace.plan_key ?? "")}
                onClick={() => apply({ plan_key: plan || null })}
              >
                Move
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Extend the trial</Label>
            <div className="flex flex-wrap gap-2">
              {EXTENSIONS.map((days) => (
                <Button
                  key={days}
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => apply({ extend_trial_days: days })}
                >
                  <CalendarClock className="size-4" />
                  +{days} days
                </Button>
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground">
              Counts from today when the trial has already lapsed, otherwise from its current end.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-[13px] text-muted-foreground">
              {suspended
                ? "Suspended — nobody in this company can sign in."
                : "Suspending locks everyone in this company out until you lift it."}
            </p>
            <Button
              variant={suspended ? "primary" : "destructive"}
              disabled={update.isPending}
              onClick={() => apply({ status: suspended ? "active" : "suspended" })}
            >
              {update.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : suspended ? (
                <PlayCircle className="size-4" />
              ) : (
                <PauseCircle className="size-4" />
              )}
              {suspended ? "Reactivate" : "Suspend"}
            </Button>
          </div>

          {detail?.payments?.length ? (
            <div>
              <p className="mb-2 text-[13px] font-medium">Recent payments</p>
              <div className="space-y-1.5">
                {detail.payments.slice(0, 6).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      {(p.paid_at ?? p.created_at).slice(0, 10)} · {p.plan_key ?? "—"}
                    </span>
                    <span className="tabular-nums">
                      {naira.format(p.amount)}
                      {p.status !== "paid" ? (
                        <span className="ml-2 text-muted-foreground">{p.status}</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-border p-3">
      <p className="text-[17px] font-semibold tabular-nums">{value}</p>
      <p className="text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}
