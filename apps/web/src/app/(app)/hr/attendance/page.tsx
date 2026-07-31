import type { Metadata } from "next";
import { MapPin, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { attendanceToday, dashboardSummary } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Attendance" };

const statusVariant = { "On time": "success", Late: "warning", Absent: "danger" } as const;

export default function AttendancePage() {
  const t = dashboardSummary.attendanceToday;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Attendance</h1>
        <div className="flex gap-2">
          <Button variant="outline">
            <QrCode /> Office QR
          </Button>
          <Button>
            <MapPin /> Clock in
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] text-muted-foreground">Present</p>
            <p className="mt-2 text-[26px] font-semibold tabular-nums text-success">{t.present}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] text-muted-foreground">Late</p>
            <p className="mt-2 text-[26px] font-semibold tabular-nums text-warning">{t.late}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-[13px] text-muted-foreground">Absent</p>
            <p className="mt-2 text-[26px] font-semibold tabular-nums text-danger">{t.absent}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Today&apos;s board</CardTitle>
          <CardDescription>Live clock-ins across all offices</CardDescription>
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
              {attendanceToday.map((row) => (
                <tr key={row.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={row.employee} size={30} />
                      <span className="font-medium">{row.employee}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{row.clockIn}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{row.clockOut ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.method}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.office}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant[row.status]}>{row.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
