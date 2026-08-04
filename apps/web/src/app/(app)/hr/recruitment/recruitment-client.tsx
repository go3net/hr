"use client";

import { useState } from "react";
import { BriefcaseBusiness, Loader2, Plus, Star, UserRoundPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  type ApplicantRow,
  useAddApplicant,
  useApplicants,
  useCreateOpening,
  useDepartments,
  useHireApplicant,
  useOpenings,
  useUpdateApplicant,
  useUpdateOpening,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const STAGES = [
  { key: "applied", label: "Applied" },
  { key: "screening", label: "Screening" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
] as const;

function NewOpeningDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [type, setType] = useState("full_time");
  const [count, setCount] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const { data: departments } = useDepartments();
  const create = useCreateOpening();

  const submit = () => {
    setError(null);
    create.mutate(
      {
        title,
        employment_type: type,
        openings_count: Number(count) || 1,
        department_id: departmentId ? Number(departmentId) : undefined,
      },
      {
        onSuccess: () => { setOpen(false); setTitle(""); },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create the opening."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New opening
        </Button>
      </DialogTrigger>
      <DialogContent title="New job opening">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="o-title">Role title</Label>
            <Input id="o-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Laravel Engineer" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-1 grid gap-2">
              <Label htmlFor="o-count">Slots</Label>
              <Input id="o-count" type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="o-type">Type</Label>
              <Select id="o-type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
                <option value="nysc">NYSC</option>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="o-dept">Department</Label>
              <Select id="o-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">None</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={create.isPending || title.trim() === ""}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create opening
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddApplicantDialog({ openingId }: { openingId: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("website");
  const [error, setError] = useState<string | null>(null);
  const add = useAddApplicant(openingId);

  const submit = () => {
    setError(null);
    add.mutate(
      { name, email: email || undefined, source },
      {
        onSuccess: () => { setOpen(false); setName(""); setEmail(""); },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add the applicant."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserRoundPlus className="size-4" />
          Add applicant
        </Button>
      </DialogTrigger>
      <DialogContent title="Add applicant">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="a-name">Full name</Label>
            <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chidi Anyanwu" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="a-email">Email</Label>
              <Input id="a-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="a-source">Source</Label>
              <Select id="a-source" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="linkedin">LinkedIn</option>
                <option value="agency">Agency</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={add.isPending || name.trim() === ""}>
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Add
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HireDialog({ applicant, onDone }: { applicant: ApplicantRow; onDone: () => void }) {
  const hire = useHireApplicant();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent
        title={`Hire ${applicant.name}`}
        description="This creates their employee record in HR with the opening's department and type."
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="h-code">Employee code</Label>
            <Input id="h-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. G3N-042" />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                hire.mutate(
                  { id: applicant.id, employee_code: code },
                  {
                    onSuccess: onDone,
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not hire."),
                  },
                )
              }
              disabled={hire.isPending || code.trim() === ""}
            >
              {hire.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm hire
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stars({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={(e) => { e.stopPropagation(); onChange(n); }} aria-label={`Rate ${n}`}>
          <Star
            className={cn(
              "size-3.5",
              value !== null && n <= value ? "fill-[var(--warning,#F59E0B)] text-[var(--warning,#F59E0B)]" : "text-border",
            )}
          />
        </button>
      ))}
    </span>
  );
}

export function RecruitmentClient() {
  const { data: openings, isLoading } = useOpenings();
  const [selectedOpening, setSelectedOpening] = useState<number | null>(null);
  const [hiring, setHiring] = useState<ApplicantRow | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const updateOpening = useUpdateOpening();
  const updateApplicant = useUpdateApplicant();

  const activeId = selectedOpening ?? openings?.[0]?.id ?? null;
  const active = openings?.find((o) => o.id === activeId) ?? null;
  const { data: applicants } = useApplicants(activeId);

  const drop = (stage: string) => {
    if (dragId === null) return;
    const applicant = (applicants ?? []).find((a) => a.id === dragId);
    setDragId(null);
    if (!applicant || applicant.stage === stage || applicant.stage === "hired") return;
    if (stage === "hired") {
      setHiring(applicant);
      return;
    }
    updateApplicant.mutate({ id: dragId, stage });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Recruitment</h1>
          <p className="text-sm text-muted-foreground">Openings and the applicant pipeline.</p>
        </div>
        <NewOpeningDialog />
      </div>

      {isLoading ? (
        <div className="flex gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-9 w-48" />
        </div>
      ) : (openings ?? []).length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BriefcaseBusiness className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">No openings yet — create the first role to start hiring.</p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {(openings ?? []).map((opening) => (
              <button
                key={opening.id}
                type="button"
                onClick={() => setSelectedOpening(opening.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] transition",
                  opening.id === activeId
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {opening.title}
                <Badge variant={opening.status === "open" ? "success" : opening.status === "closed" ? "neutral" : "warning"}>
                  {opening.status}
                </Badge>
              </button>
            ))}
          </div>

          {active ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-muted-foreground">
                {active.department ?? "No department"} · {active.employment_type.replace("_", " ")} ·{" "}
                {active.openings_count} slot{active.openings_count === 1 ? "" : "s"}
              </p>
              <div className="flex gap-2">
                <AddApplicantDialog openingId={active.id} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateOpening.mutate({ id: active.id, status: active.status === "closed" ? "open" : "closed" })
                  }
                  disabled={updateOpening.isPending}
                >
                  {active.status === "closed" ? "Reopen" : "Close opening"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
            {STAGES.map((stage) => {
              const column = (applicants ?? []).filter((a) => a.stage === stage.key);
              return (
                <div
                  key={stage.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(stage.key)}
                  className="min-h-40 rounded-[14px] border border-border bg-muted/20 p-2"
                >
                  <p className="mb-2 flex items-center justify-between px-1 text-[12px] font-medium text-muted-foreground">
                    {stage.label}
                    <span>{column.length}</span>
                  </p>
                  <div className="space-y-2">
                    {column.map((applicant) => (
                      <div
                        key={applicant.id}
                        draggable={applicant.stage !== "hired"}
                        onDragStart={() => setDragId(applicant.id)}
                        className={cn(
                          "rounded-[10px] border border-border bg-surface p-2.5 shadow-card",
                          applicant.stage !== "hired" && "cursor-grab active:cursor-grabbing",
                        )}
                      >
                        <p className="truncate text-[13px] font-medium text-foreground">{applicant.name}</p>
                        {applicant.email ? (
                          <p className="truncate text-[11px] text-muted-foreground">{applicant.email}</p>
                        ) : null}
                        <div className="mt-1.5 flex items-center justify-between">
                          <Stars
                            value={applicant.rating}
                            onChange={(n) => updateApplicant.mutate({ id: applicant.id, rating: n })}
                          />
                          {stage.key === "offer" && !applicant.hired ? (
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setHiring(applicant)}>
                              Hire
                            </Button>
                          ) : null}
                          {applicant.hired ? <Badge variant="success">Hired</Badge> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {hiring ? <HireDialog applicant={hiring} onDone={() => setHiring(null)} /> : null}
    </div>
  );
}
