"use client";

import { useState } from "react";
import { Loader2, Trash2, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import {
  useDeleteEmployee,
  useTerminateEmployee,
  type EmployeeRow,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";

const REASONS = [
  { value: "resigned", label: "Resigned" },
  { value: "dismissed", label: "Dismissed" },
  { value: "contract_ended", label: "Contract ended" },
  { value: "retired", label: "Retired" },
  { value: "other", label: "Other" },
];

/**
 * Two very different actions, deliberately kept apart.
 *
 * Terminating keeps the person and everything attached to them — payslips,
 * leave, attendance — and closes their access. Deleting removes the record and
 * is only right for one created in error.
 */
export function DangerZone({ employee, onDone }: { employee: EmployeeRow; onDone: () => void }) {
  const terminate = useTerminateEmployee();
  const remove = useDeleteEmployee();
  const [mode, setMode] = useState<"none" | "terminate" | "delete">("none");
  const [error, setError] = useState<string | null>(null);
  const [exitDate, setExitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("resigned");
  const [notes, setNotes] = useState("");
  const [confirmName, setConfirmName] = useState("");

  const alreadyExited = employee.status === "exited";

  const submitTerminate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    terminate.mutate(
      { id: employee.id, exit_date: exitDate, reason, notes: notes.trim() || null },
      {
        onSuccess: onDone,
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not terminate this employee."),
      },
    );
  };

  const submitDelete = () => {
    setError(null);
    remove.mutate(employee.id, {
      onSuccess: onDone,
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Could not delete this record."),
    });
  };

  return (
    <div className="space-y-3 rounded-[12px] border border-danger/30 p-3">
      <p className="text-[13px] font-semibold text-danger">Danger zone</p>

      {error ? <p className="text-[13px] text-danger">{error}</p> : null}

      {mode === "none" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground">
              {alreadyExited
                ? "This employee has already left."
                : "Close their access and record that they left. History is kept."}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={alreadyExited}
              onClick={() => setMode("terminate")}
            >
              <UserMinus className="size-4" />
              Terminate
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
            <p className="text-[13px] text-muted-foreground">
              Delete the record entirely. Only for one added by mistake.
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() => setMode("delete")}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      )}

      {mode === "terminate" && (
        <form className="space-y-3" onSubmit={submitTerminate}>
          <p className="text-[13px] text-muted-foreground">
            {employee.name} will be marked as exited, their sign-in disabled and any open session
            ended. Payslips, leave and attendance stay on record.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="t-date">Last working day</Label>
              <Input
                id="t-date"
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="t-reason">Reason</Label>
              <Select id="t-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="t-notes">Notes (optional)</Label>
            <Input
              id="t-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Handover done, laptop returned…"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setMode("none")}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" className="flex-1" disabled={terminate.isPending}>
              {terminate.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserMinus className="size-4" />}
              Confirm termination
            </Button>
          </div>
        </form>
      )}

      {mode === "delete" && (
        <div className="space-y-3">
          <p className="text-[13px] text-muted-foreground">
            This removes {employee.name} from the employee list. If they actually worked here,
            terminate them instead so payroll and leave history stay intact.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="d-confirm">
              Type <span className="font-medium text-foreground">{employee.employee_code}</span> to confirm
            </Label>
            <Input
              id="d-confirm"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={employee.employee_code}
              autoComplete="off"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setMode("none")}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="flex-1"
              disabled={remove.isPending || confirmName.trim() !== employee.employee_code}
              onClick={submitDelete}
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete for good
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
