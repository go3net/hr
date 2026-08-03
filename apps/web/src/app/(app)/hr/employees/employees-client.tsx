"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search, Loader2, Send, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label, FieldError } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import { type EmployeeRow, useCreateEmployee, useDepartments, useEmployees, useInviteEmployee } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  on_leave: "warning",
  suspended: "danger",
  exited: "neutral",
};

const typeLabels: Record<string, string> = {
  full_time: "Full-time",
  contract: "Contract",
  nysc: "NYSC",
  intern: "Intern",
};

const schema = z.object({
  employee_code: z.string().min(1, "Required"),
  first_name: z.string().min(1, "Required"),
  last_name: z.string().min(1, "Required"),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  employment_type: z.enum(["full_time", "contract", "nysc", "intern"]),
  department_id: z.string(),
  hired_at: z.string(),
  invite: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

function AddEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { data: departments } = useDepartments();
  const createEmployee = useCreateEmployee();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { employment_type: "full_time", department_id: "", email: "", hired_at: "", invite: true },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    createEmployee.mutate(
      {
        ...values,
        email: values.email || undefined,
        department_id: values.department_id ? Number(values.department_id) : undefined,
        hired_at: values.hired_at || undefined,
        invite: Boolean(values.invite && values.email),
      },
      {
        onSuccess: () => {
          reset();
          setOpen(false);
        },
        onError: (error) =>
          setServerError(error instanceof ApiError ? error.message : "Could not add employee."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Add employee
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Add employee"
        description="Creates the profile — documents and payroll details can be added after."
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverError && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" {...register("first_name")} />
              <FieldError message={errors.first_name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" {...register("last_name")} />
              <FieldError message={errors.last_name?.message} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="employee_code">Employee code</Label>
              <Input id="employee_code" placeholder="G3N-011" {...register("employee_code")} />
              <FieldError message={errors.employee_code?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hired_at">Hire date</Label>
              <Input id="hired_at" type="date" {...register("hired_at")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" placeholder="name@company.com" {...register("email")} />
            <FieldError message={errors.email?.message} />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" {...register("invite")} className="size-3.5 accent-[var(--primary,#2DA9DD)]" />
            Email an invitation so they can set up their own account
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="employment_type">Type</Label>
              <Select id="employment_type" {...register("employment_type")}>
                <option value="full_time">Full-time</option>
                <option value="contract">Contract</option>
                <option value="nysc">NYSC</option>
                <option value="intern">Intern</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department_id">Department</Label>
              <Select id="department_id" {...register("department_id")}>
                <option value="">No department</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Button className="w-full" type="submit" disabled={createEmployee.isPending}>
            {createEmployee.isPending && <Loader2 className="animate-spin" />}
            Add employee
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountCell({ employee }: { employee: EmployeeRow }) {
  const invite = useInviteEmployee();
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (employee.account_status === "active") {
    return <Badge variant="success">Active</Badge>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {employee.account_status === "invited" ? <Badge variant="warning">Invited</Badge> : <Badge variant="neutral">None</Badge>}
      {employee.email && employee.status !== "exited" ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => invite.mutate(employee.id, { onSuccess: (res) => setSetupUrl(res.setup_url) })}
          disabled={invite.isPending}
        >
          {invite.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
          {employee.account_status === "invited" ? "Resend" : "Invite"}
        </Button>
      ) : null}

      {setupUrl ? (
        <Dialog open onOpenChange={(open) => { if (!open) { setSetupUrl(null); setCopied(false); } }}>
          <DialogContent
            title={`Invite ${employee.name}`}
            description="The invitation email has been queued — you can also share this setup link directly (WhatsApp, chat). It's single-use and valid for 7 days."
          >
            <div className="space-y-3">
              <div className="break-all rounded-[10px] border border-border bg-muted/40 p-3 font-mono text-[12px] text-foreground">
                {setupUrl}
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(setupUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "Copied!" : "Copy link"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

export function EmployeesClient() {
  const [search, setSearch] = useState("");
  const { data: employees, isPending, isError } = useEmployees(search);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Employees</h1>
          {employees && <Badge variant="primary">{employees.length}</Badge>}
        </div>
        <AddEmployeeDialog />
      </div>

      <div className="relative min-w-[240px] max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, or email…"
          className="h-9 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-sm shadow-card placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
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
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Hired</th>
              </tr>
            </thead>
            <tbody>
              {isPending &&
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3" colSpan={8}>
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))}
              {employees?.map((e) => (
                <tr key={e.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} size={32} />
                      <div>
                        <p className="font-medium">{e.name}</p>
                        <p className="text-[12px] text-muted-foreground">{e.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{e.employee_code}</td>
                  <td className="px-4 py-2.5">{e.department ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.position ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{typeLabels[e.employment_type] ?? e.employment_type}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant={statusVariant[e.status] ?? "neutral"}>{e.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <AccountCell employee={e} />
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {e.hired_at ? formatDate(e.hired_at) : "—"}
                  </td>
                </tr>
              ))}
              {!isPending && !isError && employees?.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center gap-3 py-16 text-center">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
                        <UsersRound className="size-5 text-primary" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {search ? "No employees match your search" : "No employees yet"}
                        </p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          {search ? "Try a different name or code." : "Add your first employee to get started."}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                    Could not load employees — check that the API is running, then refresh.
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
