"use client";

import { useState } from "react";
import { Plus, Loader2, CheckSquare, Circle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { TaskDialog } from "@/components/modules/tasks/task-dialog";
import {
  TaskFields,
  draftToPayload,
  emptyDraft,
  type TaskDraft,
} from "@/components/modules/tasks/task-fields";
import { priorityVariant } from "@/components/modules/tasks/task-card";
import { useCreateTask, useTasks, useUpdateTask, type TaskRow } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

function NewTaskDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const createTask = useCreateTask();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createTask.mutate(draftToPayload(draft), {
      onSuccess: () => {
        setDraft(emptyDraft());
        setOpen(false);
      },
      onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create task."),
    });
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
        description="Leave the assignee empty to keep it yourself. Attach it to a project from that project's board."
        className="max-h-[85dvh] overflow-y-auto"
      >
        <form className="space-y-4" onSubmit={submit}>
          {error && (
            <div className="rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
              {error}
            </div>
          )}
          <TaskFields draft={draft} onChange={setDraft} idPrefix="pt" />
          <Button className="w-full" type="submit" disabled={createTask.isPending || !draft.title.trim()}>
            {createTask.isPending && <Loader2 className="animate-spin" />}
            Create task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TasksClient() {
  const listKey = { mine: true };
  const { data: tasks, isPending } = useTasks(listKey);
  const updateTask = useUpdateTask(listKey);
  const [selected, setSelected] = useState<TaskRow | null>(null);

  const open = (tasks ?? []).filter((t) => t.status !== "done");
  const done = (tasks ?? []).filter((t) => t.status === "done");

  const toggle = (task: TaskRow) =>
    updateTask.mutate({ id: task.id, status: task.status === "done" ? "todo" : "done" });

  const row = (task: TaskRow) => (
    <div
      key={task.id}
      className="flex items-center gap-3 rounded-[10px] p-2.5 transition-colors hover:bg-muted"
    >
      <button
        aria-label={task.status === "done" ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={() => toggle(task)}
        className="text-muted-foreground transition-colors hover:text-primary"
      >
        {task.status === "done" ? (
          <CheckCircle2 className="size-5 text-success" strokeWidth={1.75} />
        ) : (
          <Circle className="size-5" strokeWidth={1.75} />
        )}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(task)}>
        <p className={cn("truncate text-sm font-medium", task.status === "done" && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        {task.project && (
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className="size-1.5 rounded-full" style={{ background: task.project.color }} />
            {task.project.name}
          </p>
        )}
      </button>
      <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
      {task.due_date && (
        <span className="hidden text-[12px] tabular-nums text-muted-foreground sm:block">
          {formatDate(task.due_date)}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">My tasks</h1>
          {tasks && <Badge variant="primary">{open.length} open</Badge>}
        </div>
        <NewTaskDialog />
      </div>

      <Card>
        <CardContent className="space-y-1 p-3">
          {isPending && [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          {open.map(row)}
          {!isPending && open.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
                <CheckSquare className="size-5 text-primary" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-medium">Nothing on your plate</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Tasks assigned to you or created by you appear here.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {done.length > 0 && (
        <Card>
          <CardContent className="space-y-1 p-3">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Completed · {done.length}
            </p>
            {done.slice(0, 10).map(row)}
          </CardContent>
        </Card>
      )}

      <TaskDialog task={selected} listKey={listKey} onClose={() => setSelected(null)} />
    </div>
  );
}
