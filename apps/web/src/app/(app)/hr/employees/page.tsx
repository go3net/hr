import type { Metadata } from "next";
import { Plus, Filter, Download, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { employees } from "@/lib/demo-data";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Employees" };

const statusVariant = {
  Active: "success",
  "On leave": "warning",
  Suspended: "danger",
} as const;

export default function EmployeesPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Employees</h1>
          <Badge variant="primary">{employees.length} of 128</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md">
            <Download /> Export
          </Button>
          <Button>
            <Plus /> Add employee
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            placeholder="Search by name, code, or email…"
            className="h-9 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-sm shadow-card placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="outline" size="md">
          <Filter /> Filters
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-[12px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Hired</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} size={32} />
                      <div>
                        <p className="font-medium">{e.name}</p>
                        <p className="text-[12px] text-muted-foreground">{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{e.code}</td>
                  <td className="px-4 py-2.5">{e.department}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.position}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.employmentType}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant[e.status]}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatDate(e.hiredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
