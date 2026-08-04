"use client";

import Link from "next/link";
import { CalendarDays, CheckSquare, Clock, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBootstrap, useMyDashboard } from "@/hooks/use-api";

function Tile({
  name,
  value,
  sub,
  icon: Icon,
  loading,
  accent,
}: {
  name: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  loading: boolean;
  accent?: boolean;
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
        <p className={`mt-1 text-[13px] ${accent ? "text-success" : "text-muted-foreground"}`}>{sub}</p>
      </CardContent>
    </Card>
  );
}

function timeOf(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/**
 * The dashboard for members who cannot see company-wide figures: their own
 * day, not the organisation's.
 */
export function MyDashboard() {
  const { data: session } = useBootstrap();
  const { data: me, isPending } = useMyDashboard();
  const firstName = session?.user.name.split(" ")[0] ?? "there";

  if (me && !me.has_employee_record) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Welcome, {firstName}</h1>
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-muted">
            <UserRound className="size-5 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium">Your account isn&apos;t linked to an employee record</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
              Ask HR to set one up — then your attendance, leave and payslips appear here.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Welcome, {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s where you stand today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          name="Today"
          value={me?.clocked_in ? "Clocked in" : "Not clocked in"}
          sub={me?.clocked_in_at ? `since ${timeOf(me.clocked_in_at)}` : "clock in from Attendance"}
          icon={Clock}
          loading={isPending}
          accent={Boolean(me?.clocked_in) && !me?.is_late_today}
        />
        <Tile
          name="Leave pending"
          value={String(me?.leave_pending ?? 0)}
          sub="awaiting a decision"
          icon={CalendarDays}
          loading={isPending}
        />
        <Tile
          name="Leave taken"
          value={String(me?.leave_taken_this_year ?? 0)}
          sub="days this year"
          icon={CalendarDays}
          loading={isPending}
        />
        <Tile
          name="Open tasks"
          value={String(me?.open_tasks ?? 0)}
          sub="assigned to you"
          icon={CheckSquare}
          loading={isPending}
        />
      </div>

      {me && me.profile_percent < 100 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-medium">Your profile is {me.profile_percent}% complete</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Finish it so HR has everything they need for payroll and emergencies.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/profile">Complete profile</Link>
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: "/hr/attendance", label: "Attendance", blurb: "Clock in and review your history" },
          { href: "/hr/leave", label: "Leave", blurb: "Request time off and track balances" },
          { href: "/hr/payroll", label: "Payslips", blurb: "Download your payslips" },
        ].map((link) => (
          <Card key={link.href}>
            <Link href={link.href} className="block p-5 transition hover:bg-muted/40">
              <p className="text-[15px] font-semibold">{link.label}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{link.blurb}</p>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
