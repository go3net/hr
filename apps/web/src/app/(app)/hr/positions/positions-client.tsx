"use client";

import { useState } from "react";
import { BriefcaseBusiness, Loader2, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, Select } from "@/components/ui/dialog";
import {
  type PositionRow,
  useDeletePosition,
  useDepartments,
  usePositions,
  useSavePosition,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

function PositionDialog({ position, onDone }: { position: PositionRow | null; onDone: () => void }) {
  const save = useSavePosition();
  const { data: departments } = useDepartments();
  const [title, setTitle] = useState(position?.title ?? "");
  const [level, setLevel] = useState(position?.level ?? "");
  const [departmentId, setDepartmentId] = useState(
    position?.department_id ? String(position.department_id) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    save.mutate(
      {
        id: position?.id,
        title: title.trim(),
        level: level.trim() || null,
        department_id: departmentId ? Number(departmentId) : null,
      },
      {
        onSuccess: onDone,
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not save the position."),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent
        title={position ? `Edit ${position.title}` : "New position"}
        description="Job titles you can assign to employees — e.g. Backend Engineer, Accountant."
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="p-title">Job title</Label>
            <Input
              id="p-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backend Engineer"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="p-level">Level (optional)</Label>
              <Input
                id="p-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. Senior"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="p-dept">Department (optional)</Label>
              <Select id="p-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">Not assigned</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={save.isPending || title.trim().length < 2}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {position ? "Save changes" : "Create position"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PositionsClient() {
  const { data: positions, isPending } = usePositions();
  const deletePosition = useDeletePosition();
  const [editing, setEditing] = useState<PositionRow | null | "new">(null);
  const [error, setError] = useState<string | null>(null);

  const remove = (position: PositionRow) => {
    setError(null);
    if (!window.confirm(`Delete the ${position.title} position?`)) return;
    deletePosition.mutate(position.id, {
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Could not delete the position."),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Positions</h1>
          {positions ? <Badge variant="primary">{positions.length}</Badge> : null}
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          New position
        </Button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (positions ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
            <BriefcaseBusiness className="size-5 text-primary" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-medium">No positions yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Add the job titles used in your company, then assign them to employees.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(positions ?? []).map((position) => (
            <Card key={position.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-foreground">{position.title}</p>
                  {position.level ? (
                    <p className="text-[12px] text-muted-foreground">{position.level}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${position.title}`}
                    onClick={() => setEditing(position)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${position.title}`}
                    className="text-danger"
                    onClick={() => remove(position)}
                    disabled={deletePosition.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-auto space-y-1 text-[13px] text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <UsersRound className="size-3.5" />
                  {position.employees_count} employee{position.employees_count === 1 ? "" : "s"}
                </p>
                <p>Department: {position.department ?? "—"}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing !== null ? (
        <PositionDialog position={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
