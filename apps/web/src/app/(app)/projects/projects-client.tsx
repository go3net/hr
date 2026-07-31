"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Loader2, FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useCreateProject, useProjects } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const statusVariant = {
  active: "success",
  on_hold: "warning",
  completed: "primary",
  archived: "neutral",
} as const;

function NewProjectDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [dueOn, setDueOn] = useState("");
  const createProject = useCreateProject();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createProject.mutate(
      { name, due_on: dueOn || undefined },
      {
        onSuccess: () => {
          setName("");
          setDueOn("");
          setOpen(false);
        },
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not create project."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New project
        </Button>
      </DialogTrigger>
      <DialogContent title="New project" description="You'll be added as a member automatically.">
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Website revamp" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due_on">Due date (optional)</Label>
            <Input id="due_on" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </div>
          <Button className="w-full" type="submit" disabled={createProject.isPending}>
            {createProject.isPending && <Loader2 className="animate-spin" />}
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsClient() {
  const { data: projects, isPending, isError } = useProjects();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Projects</h1>
          {projects && <Badge variant="primary">{projects.length}</Badge>}
        </div>
        <NewProjectDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isPending && [1, 2, 3].map((i) => <Skeleton key={i} className="h-[160px] rounded-[14px]" />)}

        {projects?.map((p) => {
          const progress = p.tasks_count > 0 ? Math.round((p.done_tasks_count / p.tasks_count) * 100) : 0;
          return (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-pop">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="mt-0.5 size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                      <p className="font-semibold leading-snug">{p.name}</p>
                    </div>
                    <Badge variant={statusVariant[p.status]}>{p.status.replace("_", " ")}</Badge>
                  </div>

                  <div className="mt-4 flex-1">
                    <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                      <span>
                        {p.done_tasks_count}/{p.tasks_count} tasks
                      </span>
                      <span className="tabular-nums">{progress}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemax={100} aria-label={`${p.name} progress`}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: p.color }} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {p.members.slice(0, 4).map((m) => (
                        <Avatar key={m.id} name={m.name} size={26} className="ring-2 ring-surface" />
                      ))}
                      {p.members.length > 4 && (
                        <span className="flex size-[26px] items-center justify-center rounded-full bg-muted text-[11px] font-medium ring-2 ring-surface">
                          +{p.members.length - 4}
                        </span>
                      )}
                    </div>
                    {p.due_on && (
                      <span className="text-[12px] tabular-nums text-muted-foreground">Due {formatDate(p.due_on)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}

        {!isPending && !isError && projects?.length === 0 && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
                <FolderKanban className="size-5 text-primary" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-medium">No projects yet</p>
                <p className="mt-1 text-[13px] text-muted-foreground">Create your first project to open its board.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
