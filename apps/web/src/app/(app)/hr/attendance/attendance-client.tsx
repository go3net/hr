"use client";

import { useState } from "react";
import { MapPin, LogOut, Loader2, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAttendanceToday, useClockIn, useClockOut } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

function methodLabel(method: string): string {
  return { gps: "GPS", qr: "QR", web: "Web", biometric: "Biometric" }[method] ?? method;
}

function timeOf(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function AttendanceClient() {
  const { data, isPending } = useAttendanceToday();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const handleClockIn = () => {
    setFeedback(null);

    const submit = (payload: Parameters<typeof clockIn.mutate>[0]) =>
      clockIn.mutate(payload, {
        onSuccess: () => setFeedback({ kind: "ok", text: "Clocked in — have a great day." }),
        onError: (error) =>
          setFeedback({
            kind: "error",
            text: error instanceof ApiError ? error.message : "Clock-in failed.",
          }),
      });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          submit({ method: "gps", latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        // Location denied/unavailable → fall back to a plain web clock-in.
        () => submit({ method: "web" }),
        { timeout: 5000 },
      );
    } else {
      submit({ method: "web" });
    }
  };

  const handleClockOut = () => {
    setFeedback(null);
    clockOut.mutate(undefined, {
      onSuccess: () => setFeedback({ kind: "ok", text: "Clocked out — see you tomorrow." }),
      onError: (error) =>
        setFeedback({
          kind: "error",
          text: error instanceof ApiError ? error.message : "Clock-out failed.",
        }),
    });
  };

  const summary = data?.summary;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Attendance</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClockOut} disabled={clockOut.isPending}>
            {clockOut.isPending ? <Loader2 className="animate-spin" /> : <LogOut />} Clock out
          </Button>
          <Button onClick={handleClockIn} disabled={clockIn.isPending}>
            {clockIn.isPending ? <Loader2 className="animate-spin" /> : <MapPin />} Clock in
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={
            feedback.kind === "ok"
              ? "rounded-[10px] border border-success/30 bg-[var(--success-soft)] px-3 py-2.5 text-[13px] text-success"
              : "rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger"
          }
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] text-muted-foreground">Present today</p>
            {isPending ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-2 text-[26px] font-semibold tabular-nums text-success">{summary?.present ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] text-muted-foreground">Late arrivals</p>
            {isPending ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-2 text-[26px] font-semibold tabular-nums text-warning">{summary?.late ?? 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Today&apos;s board</CardTitle>
          <CardDescription>Live clock-ins across all offices — refreshes every minute</CardDescription>
        </CardHeader>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Clock in</th>
                <th className="px-4 py-3">Clock out</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Office</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {isPending &&
                [1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {data?.records.map((row) => (
                <tr key={row.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.employee ?? "?"} size={30} />
                      <span className="font-medium">{row.employee}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{timeOf(row.clocked_in_at)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{timeOf(row.clocked_out_at)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{methodLabel(row.method)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.office ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {row.is_late ? (
                      <Badge variant="warning">Late · {row.minutes_late}m</Badge>
                    ) : (
                      <Badge variant="success">On time</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {!isPending && data?.records.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
                        <Clock className="size-5 text-primary" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">No clock-ins yet today</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          Be the first — hit “Clock in” above.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
