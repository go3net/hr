"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  useDeleteWorkSchedule,
  useSaveWorkSchedule,
  useUnassignedSchedule,
  useWorkSchedules,
  type WorkScheduleRow,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const blank = {
  name: "",
  starts_at: "09:00",
  ends_at: "17:00",
  grace_minutes: "15",
  work_days: [1, 2, 3, 4, 5] as number[],
};

const dayLabel = (days: number[]) =>
  days.length === 0 ? "no days" : DAYS.filter((d) => days.includes(d.value)).map((d) => d.label).join(", ");

/**
 * Resumption and closing hours. Attendance marks someone late when they clock
 * in after the resumption time plus the grace period, so staff without a
 * schedule are never flagged at all.
 */
export function WorkHoursDialog() {
  const [open, setOpen] = useState(false);
  const { data: schedules, isPending } = useWorkSchedules();
  const { data: unassigned } = useUnassignedSchedule();
  const save = useSaveWorkSchedule();
  const remove = useDeleteWorkSchedule();
  const [editing, setEditing] = useState<WorkScheduleRow | null>(null);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const startNew = () => {
    setEditing(null);
    setForm(blank);
    setError(null);
  };

  const startEdit = (schedule: WorkScheduleRow) => {
    setEditing(schedule);
    setError(null);
    setForm({
      name: schedule.name,
      starts_at: schedule.starts_at,
      ends_at: schedule.ends_at,
      grace_minutes: String(schedule.grace_minutes),
      work_days: schedule.work_days,
    });
  };

  const toggleDay = (day: number) =>
    set(
      "work_days",
      form.work_days.includes(day)
        ? form.work_days.filter((d) => d !== day)
        : [...form.work_days, day].sort((a, b) => a - b),
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    save.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        name: form.name.trim(),
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        grace_minutes: Number(form.grace_minutes || 0),
        work_days: form.work_days,
      },
      {
        onSuccess: startNew,
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not save these hours."),
      },
    );
  };

  const destroy = (schedule: WorkScheduleRow) =>
    remove.mutate(schedule.id, {
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Could not delete this schedule."),
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Clock className="size-4" />
          Working hours
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Working hours"
        description="Resumption and closing times. Anyone clocking in after resumption plus the grace period is marked late."
        className="max-w-lg"
      >
        <div className="space-y-4">
          {error ? (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          ) : null}

          {unassigned && unassigned.unassigned > 0 ? (
            <p className="flex items-start gap-2 rounded-[10px] border border-warning/40 bg-[var(--warning-soft,transparent)] px-3 py-2.5 text-[13px]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={1.75} />
              <span>
                {unassigned.unassigned} member{unassigned.unassigned === 1 ? " is" : "s are"} on no
                schedule, so they are never marked late. Set one on their employee record.
              </span>
            </p>
          ) : null}

          <div className="space-y-1.5">
            {isPending && <p className="text-[13px] text-muted-foreground">Loading…</p>}
            {schedules?.length === 0 && (
              <p className="text-[13px] text-muted-foreground">
                No working hours yet — add your first below.
              </p>
            )}
            {schedules?.map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-center gap-2 rounded-[10px] border border-border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{schedule.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {schedule.starts_at}–{schedule.ends_at} · {schedule.grace_minutes} min grace ·{" "}
                    {dayLabel(schedule.work_days)}
                  </p>
                </div>
                {schedule.employees_count > 0 ? (
                  <Badge variant="neutral">{schedule.employees_count}</Badge>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${schedule.name}`}
                  onClick={() => startEdit(schedule)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${schedule.name}`}
                  className="text-danger"
                  disabled={schedule.employees_count > 0 || remove.isPending}
                  title={
                    schedule.employees_count > 0
                      ? "Staff are still on this schedule — move them first"
                      : undefined
                  }
                  onClick={() => destroy(schedule)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">
                {editing ? `Edit ${editing.name}` : "Add working hours"}
              </p>
              {editing ? (
                <Button type="button" variant="ghost" size="sm" onClick={startNew}>
                  <X className="size-4" />
                  Cancel
                </Button>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ws-name">Name</Label>
              <Input
                id="ws-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Standard hours, Early shift"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="ws-start">Resumption</Label>
                <Input
                  id="ws-start"
                  type="time"
                  value={form.starts_at}
                  onChange={(e) => set("starts_at", e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ws-end">Closing</Label>
                <Input
                  id="ws-end"
                  type="time"
                  value={form.ends_at}
                  onChange={(e) => set("ends_at", e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ws-grace">Grace (min)</Label>
                <Input
                  id="ws-grace"
                  type="number"
                  min={0}
                  max={240}
                  inputMode="numeric"
                  value={form.grace_minutes}
                  onChange={(e) => set("grace_minutes", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <span className="text-[13px] font-medium text-foreground">Working days</span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((day) => {
                  const on = form.work_days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        "h-9 min-w-11 rounded-[10px] border px-2 text-[13px] transition-colors",
                        on
                          ? "border-primary/40 bg-primary/10 font-medium text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={save.isPending || !form.name.trim() || form.work_days.length === 0}
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {editing ? "Save hours" : "Add working hours"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
