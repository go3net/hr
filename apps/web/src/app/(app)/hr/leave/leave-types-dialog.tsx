"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  useDeleteLeaveType,
  useLeaveTypes,
  useSaveLeaveType,
  type LeaveTypeRow,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

const blank = { name: "", days_per_year: "0", requires_approval: "1", is_paid: "1" };

/**
 * The kinds of leave staff can pick from when they request time off. These
 * were seeded once and never editable, so a workspace was stuck with whatever
 * it started with.
 */
export function LeaveTypesDialog() {
  const [open, setOpen] = useState(false);
  const { data: types, isPending } = useLeaveTypes();
  const save = useSaveLeaveType();
  const remove = useDeleteLeaveType();
  const [editing, setEditing] = useState<LeaveTypeRow | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const startNew = () => {
    setEditing(null);
    setForm(blank);
    setError(null);
  };

  const startEdit = (type: LeaveTypeRow) => {
    setEditing(type);
    setError(null);
    setForm({
      name: type.name,
      days_per_year: String(type.days_per_year),
      requires_approval: type.requires_approval ? "1" : "0",
      is_paid: type.is_paid ? "1" : "0",
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        days_per_year: Number(form.days_per_year || 0),
        requires_approval: form.requires_approval === "1",
        is_paid: form.is_paid === "1",
      },
      {
        onSuccess: startNew,
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not save this leave type."),
      },
    );
  };

  const destroy = (type: LeaveTypeRow) =>
    remove.mutate(type.id, {
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Could not delete this leave type."),
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings2 className="size-4" />
          Leave types
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Leave types"
        description="What staff can choose from when they request time off."
        className="max-h-[85dvh] max-w-lg overflow-y-auto"
      >
        <div className="space-y-4">
          {error ? (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            {isPending && <p className="text-[13px] text-muted-foreground">Loading…</p>}
            {types?.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                No leave types yet — add the first one below.
              </p>
            )}
            {types?.map((type) => (
              <div
                key={type.id}
                className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{type.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {type.days_per_year} days/year · {type.is_paid ? "Paid" : "Unpaid"}
                    {type.requires_approval ? " · needs approval" : " · auto-approved"}
                  </p>
                </div>
                {type.in_use ? <Badge variant="neutral">In use</Badge> : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${type.name}`}
                  onClick={() => startEdit(type)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${type.name}`}
                  className="text-danger"
                  disabled={type.in_use || remove.isPending}
                  title={type.in_use ? "Staff have already booked this — rename it instead" : undefined}
                  onClick={() => destroy(type)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">
                {editing ? `Edit ${editing.name}` : "Add a leave type"}
              </p>
              {editing ? (
                <Button type="button" variant="ghost" size="sm" onClick={startNew}>
                  <X className="size-4" />
                  Cancel
                </Button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="lt-name">Name</Label>
                <Input
                  id="lt-name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Compassionate"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lt-days">Days per year</Label>
                <Input
                  id="lt-days"
                  type="number"
                  min={0}
                  max={365}
                  inputMode="numeric"
                  value={form.days_per_year}
                  onChange={(e) => set("days_per_year", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="lt-paid">Paid?</Label>
                <Select id="lt-paid" value={form.is_paid} onChange={(e) => set("is_paid", e.target.value)}>
                  <option value="1">Paid leave</option>
                  <option value="0">Unpaid leave</option>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lt-approval">Approval</Label>
                <Select
                  id="lt-approval"
                  value={form.requires_approval}
                  onChange={(e) => set("requires_approval", e.target.value)}
                >
                  <option value="1">Needs approval</option>
                  <option value="0">Auto-approved</option>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={save.isPending || !form.name.trim()}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {editing ? "Save changes" : "Add leave type"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
