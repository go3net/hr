"use client";

import { useState } from "react";
import { Check, ClipboardList, DoorOpen, Loader2, Play } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  type ExitRow,
  useCompleteExit,
  useEmployees,
  useExits,
  useInitiateExit,
  useOnboardingDetail,
  useOnboardingIndex,
  useStartOnboarding,
  useToggleExitTask,
  useToggleOnboardingTask,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const EXIT_REASONS = [
  { value: "resignation", label: "Resignation" },
  { value: "termination", label: "Termination" },
  { value: "retirement", label: "Retirement" },
  { value: "contract_end", label: "Contract end" },
  { value: "other", label: "Other" },
];

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-[var(--primary,#2DA9DD)] transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function Checklist({
  tasks,
  onToggle,
  busy,
}: {
  tasks: { id: number; title: string; status: string }[];
  onToggle: (id: number) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => onToggle(task.id)}
          disabled={busy}
          className="flex w-full items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-2 text-left text-sm transition hover:border-primary/40"
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border",
              task.status === "done"
                ? "border-transparent bg-[var(--success,#22C55E)] text-white"
                : "border-border bg-surface",
            )}
          >
            {task.status === "done" ? <Check className="size-3" /> : null}
          </span>
          <span className={cn("text-foreground", task.status === "done" && "text-muted-foreground line-through")}>
            {task.title}
          </span>
        </button>
      ))}
    </div>
  );
}

function StartOnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [publicId, setPublicId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: employees } = useEmployees("");
  const start = useStartOnboarding();

  const candidates = (employees ?? []).filter((e) => e.status === "active");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Play className="size-4" />
          Start onboarding
        </Button>
      </DialogTrigger>
      <DialogContent title="Start onboarding" description="Seeds the standard checklist for a new hire.">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ob-emp">Employee</Label>
            <Select id="ob-emp" value={publicId} onChange={(e) => setPublicId(e.target.value)}>
              <option value="">Choose…</option>
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>
              ))}
            </Select>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                start.mutate(publicId, {
                  onSuccess: () => { setOpen(false); setPublicId(""); },
                  onError: (err) => setError(err instanceof ApiError ? err.message : "Could not start onboarding."),
                })
              }
              disabled={start.isPending || publicId === ""}
            >
              {start.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Start
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InitiateExitDialog() {
  const [open, setOpen] = useState(false);
  const [publicId, setPublicId] = useState("");
  const [reason, setReason] = useState("resignation");
  const [lastDay, setLastDay] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data: employees } = useEmployees("");
  const initiate = useInitiateExit();

  const candidates = (employees ?? []).filter((e) => e.status === "active");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <DoorOpen className="size-4" />
          Initiate exit
        </Button>
      </DialogTrigger>
      <DialogContent title="Initiate exit" description="Opens the clearance checklist for departure.">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ex-emp">Employee</Label>
            <Select id="ex-emp" value={publicId} onChange={(e) => setPublicId(e.target.value)}>
              <option value="">Choose…</option>
              {candidates.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.employee_code})</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ex-reason">Reason</Label>
              <Select id="ex-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {EXIT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ex-day">Last working day</Label>
              <Input id="ex-day" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                initiate.mutate(
                  { publicId, reason, last_working_day: lastDay },
                  {
                    onSuccess: () => { setOpen(false); setPublicId(""); setLastDay(""); },
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not initiate the exit."),
                  },
                )
              }
              disabled={initiate.isPending || publicId === "" || lastDay === ""}
            >
              {initiate.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Initiate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingCard({ publicId, name }: { publicId: string; name: string | null }) {
  const { data: detail } = useOnboardingDetail(publicId);
  const toggle = useToggleOnboardingTask();

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-foreground">{name ?? detail?.employee}</h3>
        <span className="text-sm font-semibold text-foreground">{detail?.progress ?? 0}%</span>
      </div>
      <ProgressBar value={detail?.progress ?? 0} />
      {detail ? (
        <Checklist tasks={detail.tasks} onToggle={(id) => toggle.mutate(id)} busy={toggle.isPending} />
      ) : (
        <Skeleton className="h-24" />
      )}
    </Card>
  );
}

function ExitCard({ exit }: { exit: ExitRow }) {
  const toggle = useToggleExitTask();
  const complete = useCompleteExit();
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">{exit.employee}</h3>
          <p className="text-[12px] capitalize text-muted-foreground">
            {exit.reason.replace("_", " ")} · last day{" "}
            {new Date(exit.last_working_day).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
        <Badge variant={exit.status === "completed" ? "success" : exit.status === "cancelled" ? "neutral" : "warning"}>
          {exit.status}
        </Badge>
      </div>
      <ProgressBar value={exit.progress} />
      {exit.status === "clearance" ? (
        <>
          <Checklist tasks={exit.tasks} onToggle={(id) => toggle.mutate(id)} busy={toggle.isPending} />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                complete.mutate(exit.id, {
                  onError: (err) => setError(err instanceof ApiError ? err.message : "Could not complete."),
                });
              }}
              disabled={complete.isPending || exit.progress < 100}
            >
              {complete.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Complete exit
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}

export function OnboardingClient() {
  const [tab, setTab] = useState<"onboarding" | "exits">("onboarding");
  const { data: onboarding, isLoading: onboardingLoading } = useOnboardingIndex();
  const { data: exits, isLoading: exitsLoading } = useExits();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Onboarding & exits</h1>
          <p className="text-sm text-muted-foreground">Checklists for joining and leaving, nothing forgotten.</p>
        </div>
        <div className="flex gap-2">
          <StartOnboardingDialog />
          <InitiateExitDialog />
        </div>
      </div>

      <div className="flex rounded-full border border-border bg-surface p-0.5 w-fit">
        {(["onboarding", "exits"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[13px] capitalize transition",
              tab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "onboarding" ? (
        onboardingLoading ? (
          <Skeleton className="h-56" />
        ) : (onboarding ?? []).length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">Nobody is onboarding right now.</p>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {(onboarding ?? []).map((row) =>
              row.public_id ? <OnboardingCard key={row.employee_id} publicId={row.public_id} name={row.employee} /> : null,
            )}
          </div>
        )
      ) : exitsLoading ? (
        <Skeleton className="h-56" />
      ) : (exits ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <DoorOpen className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">No exits in progress.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(exits ?? []).map((exit) => <ExitCard key={exit.id} exit={exit} />)}
        </div>
      )}
    </div>
  );
}
