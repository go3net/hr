import type { Metadata } from "next";
import {
  Users,
  Building2,
  Clock,
  FolderKanban,
  CalendarDays,
  CircleCheckBig,
  Banknote,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { AttendanceTrendChart, HeadcountChart } from "@/components/charts/dashboard-charts";
import { dashboardSummary as s, pendingApprovals, upcoming, activityFeed } from "@/lib/demo-data";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

const stats = [
  { name: "Total staff", value: String(s.totalStaff), sub: `+${s.staffDelta} this month`, icon: Users, positive: true },
  { name: "Departments", value: String(s.departments), sub: "across 3 offices", icon: Building2 },
  { name: "Attendance today", value: `${Math.round(s.attendanceToday.rate * 100)}%`, sub: `${s.attendanceToday.present} present · ${s.attendanceToday.late} late`, icon: Clock, positive: true },
  { name: "Active projects", value: String(s.activeProjects), sub: "2 due this week", icon: FolderKanban },
  { name: "Pending leave", value: String(s.pendingLeave), sub: "awaiting approval", icon: CalendarDays },
  { name: "Pending approvals", value: String(s.pendingApprovals), sub: "leave · expenses · payroll", icon: CircleCheckBig },
  { name: "Payroll this month", value: formatCurrency(s.payrollThisMonth), sub: "run scheduled Jul 28", icon: Banknote },
  { name: "Net this month", value: formatCurrency(s.revenueThisMonth - s.expensesThisMonth), sub: `rev ${formatCurrency(s.revenueThisMonth)}`, icon: ArrowUpRight, positive: true },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Good morning, Adaeze</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at Go3net Technologies today.
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
              Late arrivals rose 22% this week, concentrated in the Ikeja branch on Mondays —
              consider reviewing the 8:00 AM resumption or transit allowance. Engineering&apos;s leave
              calendar shows 4 overlapping requests in mid-August.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="transition-shadow duration-150 hover:shadow-pop">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-muted-foreground">{stat.name}</p>
                <stat.icon className="size-[18px] text-muted-foreground" strokeWidth={1.75} />
              </div>
              <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">{stat.value}</p>
              <p className={`mt-1 text-[13px] ${stat.positive ? "text-success" : "text-muted-foreground"}`}>
                {stat.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance rate</CardTitle>
            <CardDescription>Share of staff clocked in, this week</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceTrendChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Headcount by department</CardTitle>
            <CardDescription>Active employees per department</CardDescription>
          </CardHeader>
          <CardContent>
            <HeadcountChart />
          </CardContent>
        </Card>
      </div>

      {/* Lists row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
            <CardDescription>{pendingApprovals.length} items need your attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-3">
            {pendingApprovals.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-[10px] p-2 transition-colors hover:bg-muted">
                <Avatar name={a.who} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.who}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{a.detail}</p>
                </div>
                <Badge variant={a.badge}>{a.kind}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
            <CardDescription>Birthdays, events and starts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-3">
            {upcoming.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-[10px] p-2 transition-colors hover:bg-muted">
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-muted text-base">{u.icon}</span>
                <p className="min-w-0 flex-1 truncate text-sm">{u.title}</p>
                <span className="text-[13px] tabular-nums text-muted-foreground">{u.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest activity</CardTitle>
            <CardDescription>Across all modules</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 pt-3">
            {activityFeed.map((f) => (
              <div key={f.id} className="flex items-start gap-3 rounded-[10px] p-2 transition-colors hover:bg-muted">
                <Avatar name={f.who} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{f.who}</span>{" "}
                    <span className="text-muted-foreground">{f.what}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground/80">{f.when}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
