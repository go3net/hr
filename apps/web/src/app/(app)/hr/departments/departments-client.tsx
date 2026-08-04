"use client";

import { useState } from "react";
import { Building2, Loader2, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, Select } from "@/components/ui/dialog";
import {
  type DepartmentRow,
  useDeleteDepartment,
  useDepartments,
  useEmployees,
  useSaveDepartment,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

function DepartmentDialog({
  department,
  onDone,
}: {
  department: DepartmentRow | null;
  onDone: () => void;
}) {
  const save = useSaveDepartment();
  const { data: employees } = useEmployees("");
  const [name, setName] = useState(department?.name ?? "");
  const [code, setCode] = useState(department?.code ?? "");
  const [managerId, setManagerId] = useState(department?.manager_id ? String(department.manager_id) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    save.mutate(
      {
        id: department?.id,
        name: name.trim(),
        code: code.trim() || null,
        manager_id: managerId ? Number(managerId) : null,
      },
      {
        onSuccess: onDone,
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not save the department."),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent
        title={department ? `Edit ${department.name}` : "New department"}
        description="Departments group your people for reporting, leave approvals and payroll."
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="d-name">Department name</Label>
            <Input
              id="d-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="d-code">Short code (optional)</Label>
            <Input
              id="d-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ENG"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="d-head">Department head (optional)</Label>
            <Select id="d-head" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
              <option value="">Not assigned</option>
              {(employees ?? [])
                .filter((e) => e.status !== "exited")
                .map((e) => (
                  <option key={e.id} value={e.employee_id}>
                    {e.name} ({e.employee_code})
                  </option>
                ))}
            </Select>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={save.isPending || name.trim().length < 2}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {department ? "Save changes" : "Create department"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DepartmentsClient() {
  const { data: departments, isPending } = useDepartments();
  const deleteDepartment = useDeleteDepartment();
  const [editing, setEditing] = useState<DepartmentRow | null | "new">(null);
  const [error, setError] = useState<string | null>(null);

  const remove = (department: DepartmentRow) => {
    setError(null);
    if (!window.confirm(`Delete the ${department.name} department?`)) return;
    deleteDepartment.mutate(department.id, {
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Could not delete the department."),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Departments</h1>
          {departments ? <Badge variant="primary">{departments.length}</Badge> : null}
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          New department
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (departments ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
            <Building2 className="size-5 text-primary" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium">No departments yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Create your first one — you can then assign employees to it.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(departments ?? []).map((department) => (
            <Card key={department.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-foreground">{department.name}</p>
                  {department.code ? (
                    <p className="font-mono text-[12px] text-muted-foreground">{department.code}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${department.name}`}
                    onClick={() => setEditing(department)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${department.name}`}
                    className="text-danger"
                    onClick={() => remove(department)}
                    disabled={deleteDepartment.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-auto space-y-1 text-[13px] text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <UsersRound className="size-3.5" />
                  {department.employees_count} employee{department.employees_count === 1 ? "" : "s"}
                </p>
                <p>Head: {department.manager ?? "—"}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== null ? (
        <DepartmentDialog
          department={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
