"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Target, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  type KeyResultRow,
  type ObjectiveRow,
  useCheckInKeyResult,
  useCreateObjective,
  useObjectives,
  useUpdateObjective,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

function currentQuarter(): string {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          value >= 70 ? "bg-[var(--success,#22C55E)]" : value >= 35 ? "bg-[var(--primary,#2DA9DD)]" : "bg-[var(--warning,#F59E0B)]",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function NewObjectiveDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState(currentQuarter());
  const [krs, setKrs] = useState([{ title: "", target: "", unit: "" }]);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateObjective();

  const setKr = (i: number, field: "title" | "target" | "unit", value: string) =>
    setKrs((prev) => prev.map((kr, idx) => (idx === i ? { ...kr, [field]: value } : kr)));

  const valid = title.trim() !== "" && krs.every((kr) => kr.title.trim() !== "" && Number(kr.target) > 0);

  const submit = () => {
    setError(null);
    create.mutate(
      {
        title,
        period,
        key_results: krs.map((kr) => ({
          title: kr.title,
          target_value: Number(kr.target),
          unit: kr.unit || undefined,
        })),
      },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setKrs([{ title: "", target: "", unit: "" }]);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create the objective."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New objective
        </Button>
      </DialogTrigger>
      <DialogContent title="New objective" description="An objective with measurable key results." className="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="obj-title">Objective</Label>
              <Input id="obj-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grow client retention" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obj-period">Period</Label>
              <Input id="obj-period" value={period} onChange={(e) => setPeriod(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Key results</Label>
            {krs.map((kr, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_80px_32px] items-center gap-2">
                <Input value={kr.title} onChange={(e) => setKr(i, "title", e.target.value)} placeholder="e.g. Renew 8 contracts" />
                <Input type="number" value={kr.target} onChange={(e) => setKr(i, "target", e.target.value)} placeholder="Target" />
                <Input value={kr.unit} onChange={(e) => setKr(i, "unit", e.target.value)} placeholder="Unit" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove key result"
                  className="text-muted-foreground"
                  onClick={() => setKrs((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={krs.length === 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {krs.length < 10 ? (
              <Button variant="ghost" size="sm" onClick={() => setKrs((prev) => [...prev, { title: "", target: "", unit: "" }])}>
                <Plus className="size-4" />
                Add key result
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={create.isPending || !valid}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create objective
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KeyResultLine({ kr }: { kr: KeyResultRow }) {
  const checkIn = useCheckInKeyResult();
  const [value, setValue] = useState(String(kr.current_value));
  const dirty = Number(value) !== kr.current_value;

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-foreground">{kr.title}</p>
        <ProgressBar value={kr.completion} />
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-7 w-20 text-[12px]"
          aria-label={`Current value for ${kr.title}`}
        />
        <span>/ {kr.target_value}{kr.unit ? ` ${kr.unit}` : ""}</span>
        {dirty ? (
          <Button
            size="icon"
            variant="outline"
            className="size-7"
            aria-label="Save check-in"
            onClick={() => checkIn.mutate({ id: kr.id, current_value: Number(value) })}
            disabled={checkIn.isPending}
          >
            {checkIn.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function PerformanceClient() {
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const { data, isLoading } = useObjectives(scope);
  const update = useUpdateObjective();

  const objectives = data?.objectives ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Performance</h1>
          <p className="text-sm text-muted-foreground">Objectives and key results, checked in as you go.</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.canViewAll ? (
            <div className="flex rounded-full border border-border bg-surface p-0.5">
              {(["mine", "team"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[13px] capitalize transition",
                    scope === s ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          <NewObjectiveDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : objectives.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Target className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            {scope === "team" ? "No team objectives for this period yet." : "No objectives yet — set your first one."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {objectives.map((objective: ObjectiveRow) => (
            <Card key={objective.id} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold text-foreground">{objective.title}</h3>
                  <p className="text-[12px] text-muted-foreground">
                    {scope === "team" && objective.employee ? `${objective.employee} · ` : ""}
                    {objective.period}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={objective.status === "completed" ? "success" : objective.status === "cancelled" ? "neutral" : "primary"}
                  >
                    {objective.status}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{objective.progress}%</span>
                </div>
              </div>
              <ProgressBar value={objective.progress} />
              <div className="space-y-3">
                {objective.key_results.map((kr) => (
                  <KeyResultLine key={kr.id} kr={kr} />
                ))}
              </div>
              {objective.status === "active" ? (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update.mutate({ id: objective.id, status: "completed" })}
                    disabled={update.isPending}
                  >
                    <Check className="size-4" />
                    Mark complete
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
