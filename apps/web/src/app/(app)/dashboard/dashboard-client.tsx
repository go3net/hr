"use client";

import {
  Users,
  Building2,
  Clock,
  CalendarDays,
  Cake,
  UserPlus,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AttendanceTrendChart, HeadcountChart } from "@/components/charts/dashboard-charts";
import {
  useActivity,
  useBootstrap,
  useDashboardSummary,
  useDecideLeave,
  usePendingLeave,
} from "@/hooks/use-api";
import { formatDate } from "@/lib/utils";

function StatCard({
  name,
  value,
  sub,
  icon: Icon,
  loading,
  positive,
}: {
  name: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  loading: boolean;
  positive?: boolean;
}) {
  return (
    <Card className="transition-shadow duration-150 hover:shadow-pop">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">{name}</p>
          <Icon className="size-[18px] text-muted-foreground" strokeWidth={1.75} />
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{value}</p>
        )}
        <p className={`mt-1 text-[13px] ${positive ? "text-success" : "text-muted-foreground"}`}>{sub}</p>
      </CardContent>
    </Card>
  );
}

const actionLabels: Record<string, string> = {
  "leave.submitted": "submitted a leave request",
  "leave.approved": "approved a leave request",
  "leave.rejected": "rejected a leave request",
  "employee.created": "added a new employee",
  "employee.updated": "updated an employee profile",
  "employee.deleted": "removed an employee",
  "module.enabled": "enabled a module",
  "module.disabled": "disabled a module",
  "tenant.registered": "created the workspace",
};

export function DashboardClient() {
  const { data: session } = useBootstrap();
  const { data: summary, isPending: summaryLoading } = useDashboardSummary();
  const { data: pending, isPending: pendingLoading } = usePendingLeave();
  const { data: activity, isPending: activityLoading } = useActivity();
  const decide = useDecideLeave();

  const firstName = session?.user.name.split(" ")[0] ?? "there";
  const attendanceRate =
    summary && summary.attendance_today.present + summary.attendance_today.absent > 0
      ? Math.round(
          (summary.attendance_today.present /
            (summary.attendance_today.present + summary.attendance_today.absent)) *
            100,
        )
      : 0;

  const stats = [
    {
      name: "Total staff",
      value: String(summary?.total_staff ?? 0),
      sub: summary?.new_this_month ? `+${summary.new_this_month} this month` : "no new hires this month",
      icon: Users,
      positive: Boolean(summary?.new_this_month),
    },
    { name: "Departments", value: String(summary?.departments ?? 0), sub: "across the company", icon: Building2 },
    {
      name: "Attendance today",
      value: `${attendanceRate}%`,
      sub: summary
        ? `${summary.attendance_today.present} present · ${summary.attendance_today.late} late`
        : "—",
      icon: Clock,
      positive: attendanceRate >= 90,
    },
    {
      name: "Pending leave",
      value: String(summary?.pending_leave ?? 0),
      sub: "awaiting approval",
      icon: CalendarDays,
    },
    {
      name: "Birthdays",
      value: String(summary?.birthdays_this_month ?? 0),
      sub: "this month",
      icon: Cake,
    },
    {
      name: "New employees",
      value: String(summary?.new_this_month ?? 0),
      sub: "joined this month",
      icon: UserPlus,
      positive: Boolean(summary?.new_this_month),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Good morning, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at {session?.tenant?.name ?? "your company"} today.
        </p>
      </div>

      {/* AI insight strip */}
      <Card className="border-primary/25 bg-gradient-to-r from-primary/8 to-accent/8">
        <CardContent className="flex items-start gap-3 p-4">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-primary to-accent text-white">
            <Sparkles className="size-4" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium">AI insight</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {summary && summary.attendance_today.late > 0
                ? `${summary.attendance_today.late} team member${summary.attendance_today.late > 1 ? "s" : ""} arrived late today. `
                : "Attendance is clean so far today. "}
              {summary && summary.pending_leave > 0
                ? `${summary.pending_leave} leave request${summary.pending_leave > 1 ? "s are" : " is"} waiting for a decision — approving early keeps the team calendar predictable.`
                : "No leave requests are waiting on you."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatCard key={stat.name} {...stat} loading={summaryLoading} />
        ))}
      </div>

      {/* Charts (sample series until analytics endpoints land) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance rate</CardTitle>
            <CardDescription>Sample series — weekly analytics endpoint is on the roadmap</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceTrendChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Headcount by department</CardTitle>
            <CardDescription>Sample series — weekly analytics endpoint is on the roadmap</CardDescription>
          </CardHeader>
          <CardContent>
            <HeadcountChart />
          </CardContent>
        </Card>
      </div>

      {/* Lists row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending leave approvals</CardTitle>
            <CardDescription>
              {pending?.length ? `${pending.length} request${pending.length > 1 ? "s" : ""} need a decision` : "You're all caught up"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-3">
            {pendingLoading &&
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            {pending?.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-[10px] p-2 transition-colors hover:bg-muted">
                <Avatar name={r.employee ?? "?"} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.employee}</p>
                  <p className="truncate text-[13px] text-muted-foreground">
                    {r.type} · {formatDate(r.start_date)} – {formatDate(r.end_date)} · {r.days}d
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label="Reject"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, decision: "reject" })}
                  >
                    <X />
                  </Button>
                  <Button
                    size="sm"
                    aria-label="Approve"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, decision: "approve" })}
                  >
                    <Check />
                  </Button>
                </div>
              </div>
            ))}
            {pending?.length === 0 && (
              <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                No pending requests — approvals you receive will appear here.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest activity</CardTitle>
            <CardDescription>Audited actions across the workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-3">
            {activityLoading &&
              [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            {activity?.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-[10px] p-2 transition-colors hover:bg-muted">
                <Avatar name={entry.actor ?? "System"} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{entry.actor ?? "System"}</span>{" "}
                    <span className="text-muted-foreground">
                      {actionLabels[entry.action] ?? entry.action}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground/80">
                    {new Date(entry.at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {entry.entity_type && <Badge variant="neutral">{entry.entity_type}</Badge>}
              </div>
            ))}
            {activity?.length === 0 && (
              <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">
                Workspace activity will appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
