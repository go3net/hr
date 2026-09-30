"use client";

import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useBootstrap, useEmployeeDetail } from "@/hooks/use-api";
import { formatCurrency, formatDate } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
  nysc: "NYSC",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  probation: "warning",
  suspended: "danger",
  exited: "neutral",
};

const ACCOUNT_LABEL: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> = {
  active: { label: "Can sign in", variant: "success" },
  invited: { label: "Invited, not accepted", variant: "warning" },
  disabled: { label: "Sign-in disabled", variant: "neutral" },
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        {hint ? <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function money(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return formatCurrency(Number(value));
}

/**
 * The whole record in one place, read-only.
 *
 * The edit dialog is for changing things and hides what it does not edit; this
 * is for looking — everything the employee submitted and everything HR added,
 * including the parts that were being stored and never shown back.
 */
export function EmployeeProfile({ id }: { id: string }) {
  const { data: e, isPending, isError } = useEmployeeDetail(id);
  const { data: session } = useBootstrap();
  const permissions = session?.permissions ?? [];
  const canSeeSensitive = permissions.includes("*") || permissions.includes("hr.employees.view_sensitive");
  const canEdit = permissions.includes("*") || permissions.includes("hr.employees.manage");

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !e) {
    return (
      <Card className="p-12 text-center">
        <p className="text-sm font-medium">This employee could not be loaded</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          They may have been removed, or you may not have access.
        </p>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link href="/hr/employees">Back to employees</Link>
        </Button>
      </Card>
    );
  }

  const allowances = Object.entries(e.allowances ?? {}).filter(([, v]) => Number(v) > 0);
  const gross = Number(e.base_salary ?? 0) + allowances.reduce((sum, [, v]) => sum + Number(v), 0);
  const account = ACCOUNT_LABEL[e.account_status ?? ""] ?? { label: "No account", variant: "neutral" as const };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back to employees">
          <Link href="/hr/employees">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <Avatar name={e.name} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{e.name}</h1>
          <p className="text-[13px] text-muted-foreground">
            {e.employee_code}
            {e.position ? ` · ${e.position}` : ""}
            {e.department ? ` · ${e.department}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[e.status] ?? "neutral"}>{e.status}</Badge>
          <Badge variant={account.variant}>{account.label}</Badge>
          {canEdit ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/hr/employees?edit=${e.id}`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Personal">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Work email" value={e.email} />
            <Field label="Phone" value={e.phone} />
            <Field label="Date of birth" value={e.date_of_birth ? formatDate(e.date_of_birth) : null} />
            <Field label="Gender" value={e.gender} />
            <Field label="Marital status" value={e.marital_status} />
            <div className="col-span-2">
              <Field label="Address" value={e.address} />
            </div>
          </div>
        </Section>

        <Section title="Employment">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Department" value={e.department} />
            <Field label="Position" value={e.position} />
            <Field label="Employment type" value={TYPE_LABELS[e.employment_type] ?? e.employment_type} />
            <Field label="Hired" value={e.hired_at ? formatDate(e.hired_at) : null} />
            <Field label="Reports to" value={e.manager} />
            <Field label="Profile completeness" value={`${e.profile_percent ?? 0}%`} />
          </div>
        </Section>

        <Section
          title="Emergency contacts"
          hint="Submitted by the employee from their own profile."
        >
          {e.emergency_contacts?.length ? (
            <div className="space-y-2">
              {e.emergency_contacts.map((c) => (
                <div key={c.id} className="rounded-[10px] bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    {c.name} · <span className="font-normal text-muted-foreground">{c.relationship}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {c.phone}
                    {c.address ? ` · ${c.address}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Nothing submitted yet.</p>
          )}
        </Section>

        <Section title="Guarantors" hint="Submitted by the employee from their own profile.">
          {e.guarantors?.length ? (
            <div className="space-y-2">
              {e.guarantors.map((g) => (
                <div key={g.id} className="rounded-[10px] bg-muted/40 p-3 text-sm">
                  <p className="font-medium">
                    {g.name} · <span className="font-normal text-muted-foreground">{g.occupation}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {g.phone}
                    {g.address ? ` · ${g.address}` : ""}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">Nothing submitted yet.</p>
          )}
        </Section>

        {canSeeSensitive ? (
          <>
            <Section title="Pay" hint="What payroll runs on.">
              <div className="space-y-3">
                <Field label="Basic salary" value={money(e.base_salary)} />
                {allowances.length ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Allowances
                    </p>
                    {allowances.map(([name, value]) => (
                      <div key={name} className="flex items-center justify-between text-sm">
                        <span className="capitalize text-muted-foreground">{name.replace(/_/g, " ")}</span>
                        <span className="tabular-nums">{money(value)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-border pt-1.5 text-sm font-medium">
                      <span>Gross</span>
                      <span className="tabular-nums">{formatCurrency(gross)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">No allowances set.</p>
                )}
              </div>
            </Section>

            <Section title="Bank and statutory">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank" value={e.bank_name} />
                <Field label="Account number" value={e.bank_account_number} />
                <Field label="Pension PIN" value={e.pension_pin} />
                <Field label="NIN" value={e.nin} />
                <Field label="BVN" value={e.bvn} />
              </div>
              {e.medical_notes ? (
                <div className="mt-4 border-t border-border pt-4">
                  <Field label="Medical notes" value={e.medical_notes} />
                </div>
              ) : null}
            </Section>
          </>
        ) : (
          <Section title="Pay and statutory details">
            <p className="text-[13px] text-muted-foreground">
              Hidden — these need the &quot;view sensitive details&quot; permission.
            </p>
          </Section>
        )}

        <Section title="History" hint="Joining, changes and exits recorded against this record.">
          {e.history?.length ? (
            <ol className="space-y-3">
              {[...e.history]
                .sort((a, b) => (b.occurred_on ?? "").localeCompare(a.occurred_on ?? ""))
                .map((ev) => (
                  <li key={ev.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="font-medium capitalize">{ev.title || ev.type.replace(/_/g, " ")}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {ev.occurred_on ? formatDate(ev.occurred_on) : "No date"}
                        {ev.notes ? ` · ${ev.notes}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="text-[13px] text-muted-foreground">Nothing recorded yet.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
