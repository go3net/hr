"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { useAttendanceHistory, useEmployees, type AttendanceRow } from "@/hooks/use-api";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDay(d);
}

const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const dayOf = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** Worked time, from the two stamps. Blank until someone has clocked out. */
function hoursWorked(row: AttendanceRow): string {
  if (!row.clocked_in_at || !row.clocked_out_at) return "—";
  const mins = Math.round(
    (new Date(row.clocked_out_at).getTime() - new Date(row.clocked_in_at).getTime()) / 60000,
  );
  if (mins <= 0) return "—";
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

/**
 * Its own component so the employee list is only ever fetched by someone
 * allowed to read it — staff may open this page, and firing a request that
 * comes back 403 for them is noise, not a filter.
 */
function EmployeeFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: employees } = useEmployees("");

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="att-emp">Employee</Label>
      <Select id="att-emp" className="sm:w-52" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Everyone</option>
        {(employees ?? []).map((e) => (
          <option key={e.id} value={e.employee_id}>
            {e.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * Attendance beyond today.
 *
 * Every clock-in has always been stored; only today's was ever shown, so from
 * a distance the history looked as though it were being thrown away each
 * night. This is the screen that reads it back — and the one payroll disputes
 * and absence conversations actually need.
 */
export function AttendanceHistory({ canViewAll }: { canViewAll: boolean }) {
  const [from, setFrom] = useState(() => daysAgo(29));
  const [to, setTo] = useState(() => isoDay(new Date()));
  const [employeeId, setEmployeeId] = useState("");
  const [lateOnly, setLateOnly] = useState(false);

  const { data: rows, isPending } = useAttendanceHistory({
    from,
    to,
    employeeId: canViewAll ? employeeId : undefined,
    lateOnly,
  });

  const present = rows?.length ?? 0;
  const late = rows?.filter((r) => r.is_late).length ?? 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarRange className="size-4 text-muted-foreground" strokeWidth={1.75} />
          History
        </CardTitle>
        <CardDescription>
          {canViewAll
            ? "Every recorded day. Narrow it by person or date range."
            : "Your own recorded days."}
        </CardDescription>
      </CardHeader>

      <div className="flex flex-wrap items-end gap-3 px-5 pt-4">
        <div className="grid gap-1.5">
          <Label htmlFor="att-from">From</Label>
          <Input id="att-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="att-to">To</Label>
          <Input id="att-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        {canViewAll && <EmployeeFilter value={employeeId} onChange={setEmployeeId} />}
        <label className="flex h-10 cursor-pointer items-center gap-2 text-[13px] sm:h-9">
          <input
            type="checkbox"
            checked={lateOnly}
            onChange={(e) => setLateOnly(e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          Late days only
        </label>
      </div>

      <p className="px-5 pt-3 text-[13px] text-muted-foreground">
        {isPending ? "Loading…" : `${present} day${present === 1 ? "" : "s"} recorded · ${late} late`}
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] whitespace-nowrap text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
              <th className="px-4 py-3">Date</th>
              {canViewAll && <th className="px-4 py-3">Employee</th>}
              <th className="px-4 py-3">Clock in</th>
              <th className="px-4 py-3">Clock out</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isPending &&
              [1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3" colSpan={canViewAll ? 6 : 5}>
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))}
            {rows?.map((row) => (
              <tr key={row.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                <td className="px-4 py-2.5 font-medium">{dayOf(row.work_date)}</td>
                {canViewAll && <td className="px-4 py-2.5">{row.employee ?? "—"}</td>}
                <td className="px-4 py-2.5 tabular-nums">{timeOf(row.clocked_in_at)}</td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                  {timeOf(row.clocked_out_at)}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{hoursWorked(row)}</td>
                <td className="px-4 py-2.5">
                  {row.is_late ? (
                    // "Late · 0m" reads like a contradiction; some records are
                    // flagged late without a minute count behind them.
                    <Badge variant="warning">
                      {row.minutes_late > 0 ? `Late · ${row.minutes_late}m` : "Late"}
                    </Badge>
                  ) : (
                    <Badge variant="success">On time</Badge>
                  )}
                  {row.left_early ? (
                    <Badge variant="neutral" className="ml-1.5">
                      Left early
                    </Badge>
                  ) : null}
                </td>
              </tr>
            ))}
            {!isPending && rows?.length === 0 && (
              <tr>
                <td
                  colSpan={canViewAll ? 6 : 5}
                  className="px-4 py-14 text-center text-[13px] text-muted-foreground"
                >
                  Nothing recorded in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
