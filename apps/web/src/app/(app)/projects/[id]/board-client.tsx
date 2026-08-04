"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { TaskCard } from "@/components/modules/tasks/task-card";
import { TaskDialog } from "@/components/modules/tasks/task-dialog";
import {
  TaskFields,
  draftToPayload,
  emptyDraft,
  type TaskDraft,
} from "@/components/modules/tasks/task-fields";
import { useCreateTask, useProject, useTasks, useUpdateTask, type TaskRow } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "review", label: "In review" },
  { key: "done", label: "Done" },
] as const;

type Status = (typeof COLUMNS)[number]["key"];

function NewTaskDialog({ projectId }: { projectId: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const createTask = useCreateTask();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createTask.mutate(
      { ...draftToPayload(draft, { withStatus: true }), project_id: projectId },
      {
        onSuccess: () => {
          setDraft(emptyDraft());
          setOpen(false);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create task."),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New task
        </Button>
      </DialogTrigger>
      <DialogContent
        title="New task"
        description="Leave the assignee empty to keep it yourself."
        className="max-h-[85dvh] overflow-y-auto"
      >
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <TaskFields draft={draft} onChange={setDraft} idPrefix="nt" showStatus />
          <Button className="w-full" type="submit" disabled={createTask.isPending || !draft.title.trim()}>
            {createTask.isPending && <Loader2 className="animate-spin" />}
            Create task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BoardClient({ projectId }: { projectId: number }) {
  const listKey = { projectId };
  const { data: project } = useProject(projectId);
  const { data: tasks, isPending } = useTasks(listKey);
  const updateTask = useUpdateTask(listKey);
  const [selected, setSelected] = useState<TaskRow | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  const byStatus = (status: Status) =>
    (tasks ?? []).filter((t) => t.status === status).sort((a, b) => a.position - b.position);

  const handleDrop = (status: Status) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = Number(e.dataTransfer.getData("text/task-id"));
    if (!id) return;
    const task = tasks?.find((t) => t.id === id);
    if (!task || task.status === status) return;
    const position = byStatus(status).length + 1;
    updateTask.mutate({ id, status, position });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to projects">
            <Link href="/projects">
              <ArrowLeft />
            </Link>
          </Button>
          <span className="size-2.5 rounded-full" style={{ background: project?.color ?? "var(--primary)" }} />
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">{project?.name ?? "…"}</h1>
          {project && (
            <Badge variant="neutral">
              {project.done_tasks_count}/{project.tasks_count} done
            </Badge>
          )}
        </div>
        <NewTaskDialog projectId={projectId} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = byStatus(col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver((prev) => (prev === col.key ? null : prev))}
              onDrop={handleDrop(col.key)}
              className={cn(
                "flex min-h-[320px] flex-col rounded-[14px] border border-border bg-muted/40 p-3 transition-colors",
                dragOver === col.key && "border-primary/50 bg-primary/5",
              )}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-[13px] font-semibold">{col.label}</p>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[12px] tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>

              <div className="flex-1 space-y-2.5">
                {isPending && [1, 2].map((i) => <Skeleton key={i} className="h-[76px] rounded-[12px]" />)}
                {items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", String(task.id))}
                    onClick={() => setSelected(task)}
                  />
                ))}
                {!isPending && items.length === 0 && (
                  <p className="px-1 py-4 text-center text-[12px] text-muted-foreground/70">
                    Drop tasks here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog task={selected} listKey={listKey} onClose={() => setSelected(null)} />
    </div>
  );
}
