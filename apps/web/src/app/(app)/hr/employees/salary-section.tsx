"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/** Allowances are stored as a JSON map of label → monthly amount. */
export type AllowanceRow = { key: string; amount: string };

export const toAllowanceRows = (map: Record<string, number | string> | undefined): AllowanceRow[] =>
  Object.entries(map ?? {}).map(([key, amount]) => ({ key, amount: String(amount) }));

export const fromAllowanceRows = (rows: AllowanceRow[]): Record<string, number> =>
  Object.fromEntries(
    rows
      .filter((r) => r.key.trim() && r.amount !== "")
      .map((r) => [r.key.trim(), Number(r.amount)]),
  );

const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

const SUGGESTIONS = ["Housing", "Transport", "Utility", "Meal", "Leave allowance"];

/**
 * Payroll only picks up employees who have a base salary, so without this
 * section a run finds nobody. Gross is basic + allowances; pension and PAYE
 * come off that.
 */
export function SalarySection({
  baseSalary,
  onBaseSalaryChange,
  allowances,
  onAllowancesChange,
}: {
  baseSalary: string;
  onBaseSalaryChange: (value: string) => void;
  allowances: AllowanceRow[];
  onAllowancesChange: (rows: AllowanceRow[]) => void;
}) {
  const [newKey, setNewKey] = useState("");

  const basic = Number(baseSalary || 0);
  const allowanceTotal = allowances.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const gross = basic + allowanceTotal;

  const addAllowance = (key: string) => {
    const name = key.trim();
    if (!name || allowances.some((r) => r.key.toLowerCase() === name.toLowerCase())) return;
    onAllowancesChange([...allowances, { key: name, amount: "" }]);
    setNewKey("");
  };

  const update = (index: number, patch: Partial<AllowanceRow>) =>
    onAllowancesChange(allowances.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const remove = (index: number) => onAllowancesChange(allowances.filter((_, i) => i !== index));

  return (
    <div className="space-y-3 rounded-[12px] border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">Salary structure</p>
        <span className="text-[13px] text-muted-foreground">
          Gross <span className="font-medium text-foreground tabular-nums">{money(gross)}</span>/mo
        </span>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="e-basic">Basic salary (monthly)</Label>
        <Input
          id="e-basic"
          type="number"
          min={0}
          step="1000"
          inputMode="decimal"
          value={baseSalary}
          onChange={(e) => onBaseSalaryChange(e.target.value)}
          placeholder="e.g. 450000"
        />
        <p className="text-[12px] text-muted-foreground">
          Payroll only includes staff who have a basic salary set.
        </p>
      </div>

      {allowances.length > 0 && (
        <div className="space-y-2">
          {allowances.map((row, index) => (
            <div key={row.key} className="flex items-end gap-2">
              <div className="grid flex-1 gap-1.5">
                <Label htmlFor={`allw-${index}`} className="text-[12px]">{row.key}</Label>
                <Input
                  id={`allw-${index}`}
                  type="number"
                  min={0}
                  step="1000"
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => update(index, { amount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${row.key}`}
                onClick={() => remove(index)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="e-allowance-new" className="text-[12px]">Add an allowance</Label>
          <Input
            id="e-allowance-new"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addAllowance(newKey);
              }
            }}
            placeholder="Housing, Transport…"
          />
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Add allowance" onClick={() => addAllowance(newKey)}>
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.filter((s) => !allowances.some((r) => r.key.toLowerCase() === s.toLowerCase())).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => addAllowance(s)}
            className="rounded-full border border-border px-2.5 py-0.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}
