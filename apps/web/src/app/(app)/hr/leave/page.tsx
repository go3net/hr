import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { leaveRequests, leaveBalances } from "@/lib/demo-data";

export const metadata: Metadata = { title: "Leave" };

const statusVariant = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
} as const;

export default function LeavePage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Leave</h1>
        <Button>
          <Plus /> Request leave
        </Button>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {leaveBalances.map((b) => {
          const left = b.total - b.used;
          const pct = (b.used / b.total) * 100;
          return (
            <Card key={b.type}>
              <CardContent className="p-5">
                <p className="text-[13px] text-muted-foreground">{b.type} leave</p>
                <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
                  {left}
                  <span className="text-[15px] font-normal text-muted-foreground"> / {b.total} days left</span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={b.used} aria-valuemax={b.total} aria-label={`${b.type} leave used`}>
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Requests table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaveRequests.map((r) => (
                <tr key={r.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.employee} size={30} />
                      <span className="font-medium">{r.employee}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{r.type}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{r.range}</td>
                  <td className="px-4 py-2.5 tabular-nums">{r.days}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status === "Pending" ? (
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline">Reject</Button>
                        <Button size="sm">Approve</Button>
                      </div>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    )}
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
