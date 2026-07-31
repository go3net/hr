"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  useDecideLeave,
  useLeaveBalances,
  useLeaveRequests,
  useLeaveTypes,
  useSubmitLeave,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const statusVariant = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
} as const;

const schema = z.object({
  leave_type_id: z.string().min(1, "Pick a leave type"),
  start_date: z.string().min(1, "Required"),
  end_date: z.string().min(1, "Required"),
  reason: z.string(),
});

type FormValues = z.infer<typeof schema>;

function RequestLeaveDialog() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { data: types } = useLeaveTypes();
  const submitLeave = useSubmitLeave();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { leave_type_id: "", start_date: "", end_date: "", reason: "" },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    submitLeave.mutate(
      {
        leave_type_id: Number(values.leave_type_id),
        start_date: values.start_date,
        end_date: values.end_date,
        reason: values.reason || undefined,
      },
      {
        onSuccess: () => {
          reset();
          setOpen(false);
        },
        onError: (error) =>
          setServerError(error instanceof ApiError ? error.message : "Could not submit request."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Request leave
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Request leave"
        description="Weekends are excluded automatically. Your balance is checked on submit."
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {serverError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="leave_type_id">Leave type</Label>
            <Select id="leave_type_id" {...register("leave_type_id")}>
              <option value="">Select a type…</option>
              {types?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {t.days_per_year} days/yr
                </option>
              ))}
            </Select>
            <FieldError message={errors.leave_type_id?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">First day</Label>
              <Input id="start_date" type="date" {...register("start_date")} />
              <FieldError message={errors.start_date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">Last day</Label>
              <Input id="end_date" type="date" {...register("end_date")} />
              <FieldError message={errors.end_date?.message} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input id="reason" placeholder="A short note for your approver" {...register("reason")} />
          </div>

          <Button className="w-full" type="submit" disabled={submitLeave.isPending}>
            {submitLeave.isPending && <Loader2 className="animate-spin" />}
            Submit request
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveClient() {
  const { data: balances, isPending: balancesLoading } = useLeaveBalances();
  const { data: requests, isPending: requestsLoading } = useLeaveRequests();
  const decide = useDecideLeave();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Leave</h1>
        <RequestLeaveDialog />
      </div>

      {/* My balances */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {balancesLoading &&
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[120px] w-full rounded-[14px]" />)}
        {balances?.slice(0, 4).map((b) => {
          const pct = b.entitled > 0 ? (b.used / b.entitled) * 100 : 0;
          return (
            <Card key={b.type}>
              <CardContent className="p-5">
                <p className="text-[13px] text-muted-foreground">{b.type} leave</p>
                <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
                  {b.remaining}
                  <span className="text-[15px] font-normal text-muted-foreground"> / {b.entitled} days left</span>
                </p>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuenow={b.used}
                  aria-valuemax={b.entitled}
                  aria-label={`${b.type} leave used`}
                >
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Requests */}
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
              {requestsLoading &&
                [1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {requests?.map((r) => (
                <tr key={r.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.employee ?? "?"} size={30} />
                      <span className="font-medium">{r.employee}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{r.type}</td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {formatDate(r.start_date)} – {formatDate(r.end_date)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{r.days}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant[r.status] ?? "neutral"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {r.status === "pending" ? (
                      <div className="inline-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: r.id, decision: "reject" })}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: r.id, decision: "approve" })}
                        >
                          Approve
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!requestsLoading && requests?.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
                        <CalendarDays className="size-5 text-primary" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">No leave requests yet</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          Requests you submit will appear here.
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
