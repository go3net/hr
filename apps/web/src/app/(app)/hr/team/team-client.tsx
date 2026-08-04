"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, Clock, Users2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { type TeamMemberRow, useBootstrap, useMyTeam } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const TODAY_META: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" | "primary" }> = {
  present: { label: "Present", variant: "success" },
  late: { label: "Late", variant: "warning" },
  absent: { label: "Not clocked in", variant: "neutral" },
  on_leave: { label: "On leave", variant: "primary" },
};

function timeOf(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function TeamClient() {
  const { data: session } = useBootstrap();
  const permissions = session?.permissions ?? [];
  const canSeeAll = permissions.includes("*") || permissions.includes("hr.employees.view");
  const [scopeAll, setScopeAll] = useState(false);
  const { data, isPending } = useMyTeam(scopeAll);

  const team = data?.team ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">My team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scopeAll ? "Everyone in the workspace." : "The people who report to you."}
          </p>
        </div>
        {canSeeAll ? (
          <div className="flex rounded-full border border-border bg-surface p-0.5">
            {[
              { key: false, label: "My reports" },
              { key: true, label: "Everyone" },
            ].map((option) => (
              <button
                key={String(option.key)}
                type="button"
                onClick={() => setScopeAll(option.key)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-[13px] transition",
                  scopeAll === option.key
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        {[
          { label: "Team size", value: meta?.team_size },
          { label: "In today", value: meta?.present_today },
          { label: "On leave", value: meta?.on_leave_today },
          { label: "Leave to approve", value: meta?.pending_leave },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl">{stat.value ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0" />
          </Card>
        ))}
      </div>

      {meta && meta.pending_leave > 0 && meta.can_approve_leave ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <CalendarCheck className="size-4 text-primary" />
            {meta.pending_leave} leave request{meta.pending_leave === 1 ? "" : "s"} from your team
            {meta.pending_leave === 1 ? " is" : " are"} waiting on you.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/hr/leave">Review leave</Link>
          </Button>
        </Card>
      ) : null}

      {isPending ? (
        <Skeleton className="h-64" />
      ) : team.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
            <Users2 className="size-5 text-primary" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium">
              {meta?.has_employee_record === false ? "No employee record" : "Nobody reports to you yet"}
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
              {meta?.has_employee_record === false
                ? "Your account isn't linked to an employee profile. Ask HR to set one up."
                : "HR can assign staff to you by setting you as their manager on the employee record."}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                  <th className="px-4 py-3">Team member</th>
                  <th className="px-4 py-3">Position</th>
                  <th className="px-4 py-3">Today</th>
                  <th className="px-4 py-3">Clocked in</th>
                  <th className="px-4 py-3">Profile</th>
                </tr>
              </thead>
              <tbody>
                {team.map((member: TeamMemberRow) => (
                  <tr key={member.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={member.name} size={32} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{member.name}</p>
                          <p className="truncate text-[12px] text-muted-foreground">
                            {member.department ?? "No department"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{member.position ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={TODAY_META[member.today].variant}>{TODAY_META[member.today].label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {timeOf(member.clocked_in_at)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          "text-[13px]",
                          member.profile_percent === 100 ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        {member.profile_percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
