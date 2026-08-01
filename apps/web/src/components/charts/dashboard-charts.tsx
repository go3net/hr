"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
export type AttendancePoint = { day: string; rate: number; present: number };
export type HeadcountPoint = { department: string; count: number };

/* Chart colors come from validated theme tokens (--chart-1 / --chart-2). */

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-border bg-surface-elevated px-3 py-2 text-[13px] shadow-pop">
      <p className="font-medium text-foreground">{label}</p>
      <p className="tabular-nums text-muted-foreground">
        {payload[0].value}
        {suffix}
      </p>
    </div>
  );
}

const axisTick = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

export function AttendanceTrendChart({ data }: { data: AttendancePoint[] }) {
  const latest = data[data.length - 1];
  return (
    <div
      className="h-[240px] w-full"
      role="img"
      aria-label={`Attendance rate over the last ${data.length} working days${latest ? `, most recently ${latest.rate}%` : ""}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
          <Tooltip content={<ChartTooltip suffix="%" />} cursor={{ stroke: "var(--border)" }} />
          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#attendanceFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HeadcountChart({ data }: { data: HeadcountPoint[] }) {
  const largest = data[0];
  return (
    <div
      className="h-[240px] w-full"
      role="img"
      aria-label={`Headcount by department${largest ? `, ${largest.department} largest with ${largest.count} people` : ""}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="department"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            interval={0}
            tickFormatter={(v: string) => (v.length > 7 ? `${v.slice(0, 6)}…` : v)}
          />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip suffix=" people" />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((d) => (
              <Cell key={d.department} fill="var(--chart-1)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
