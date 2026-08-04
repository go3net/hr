"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Send, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, Select } from "@/components/ui/dialog";
import {
  useAddTaskComment,
  useDeleteTask,
  useTaskComments,
  useUpdateTask,
  type TaskRow,
} from "@/hooks/use-api";
import { priorityVariant } from "./task-card";
import { TaskFields, draftToPayload, emptyDraft, type TaskDraft } from "./task-fields";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

function isOverdue(task: TaskRow): boolean {
  if (!task.due_date || task.status === "done") return false;
  const due = new Date(task.due_date);
  due.setHours(23, 59, 59, 999);
  return due.getTime() < Date.now();
}

export function TaskDialog({
  task,
  listKey,
  onClose,
}: {
  task: TaskRow | null;
  listKey: { projectId?: number; mine?: boolean };
  onClose: () => void;
}) {
  const { data: comments } = useTaskComments(task?.id ?? null);
  const addComment = useAddTaskComment();
  const updateTask = useUpdateTask(listKey);
  const deleteTask = useDeleteTask();
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!task) return null;

  const startEditing = () => {
    setError(null);
    setDraft({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      status: task.status,
      due_date: task.due_date ?? "",
      assignee_ids: task.assignees.map((a) => a.id),
    });
    setEditing(true);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    updateTask.mutate(
      { id: task.id, ...draftToPayload(draft, { withStatus: true }) },
      {
        onSuccess: () => setEditing(false),
        onError: (err) =>
          setError(err instanceof ApiError ? err.message : "Could not save this task."),
      },
    );
  };

  const remove = () =>
    deleteTask.mutate(task.id, {
      onSuccess: onClose,
      onError: (err) =>
        setError(err instanceof ApiError ? err.message : "Could not delete this task."),
    });

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    addComment.mutate({ taskId: task.id, body }, { onSuccess: () => setBody("") });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={editing ? "Edit task" : task.title}
        className="max-h-[85dvh] max-w-lg overflow-y-auto"
      >
        {error && (
          <div className="mb-3 rounded-[10px] border border-danger/30 bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-danger">
            {error}
          </div>
        )}

        {editing ? (
          <form className="space-y-4" onSubmit={save}>
            <TaskFields draft={draft} onChange={setDraft} idPrefix={`et-${task.id}`} showStatus />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                <X className="size-4" />
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={updateTask.isPending || !draft.title.trim()}>
                {updateTask.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Save changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Status and priority stay one tap away — they change far more
                often than anything else on a task. */}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={task.status}
                onChange={(e) => updateTask.mutate({ id: task.id, status: e.target.value })}
                className="w-auto min-w-[140px]"
                aria-label="Status"
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="review">In review</option>
                <option value="done">Done</option>
              </Select>
              <Select
                value={task.priority}
                onChange={(e) => updateTask.mutate({ id: task.id, priority: e.target.value })}
                className="w-auto min-w-[120px]"
                aria-label="Priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
              <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
              {task.due_date && (
                <Badge variant={isOverdue(task) ? "danger" : "neutral"}>
                  {isOverdue(task) ? "Overdue" : "Due"} {formatDate(task.due_date)}
                </Badge>
              )}
            </div>

            {task.description ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground/70">No description yet.</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-muted-foreground">Assigned to</span>
              {task.assignees.length > 0 ? (
                task.assignees.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 py-0.5 pl-0.5 pr-2 text-[13px]"
                  >
                    <Avatar name={a.name} size={20} />
                    {a.name}
                  </span>
                ))
              ) : (
                <span className="text-[13px] text-muted-foreground/70">Nobody</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="size-4" />
                Edit task
              </Button>
              {confirmDelete ? (
                <>
                  <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={remove}
                    disabled={deleteTask.isPending}
                  >
                    {deleteTask.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    Delete for good
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-[13px] font-medium">Comments</p>
              <div className="mt-2 max-h-56 space-y-3 overflow-y-auto pr-1">
                {comments?.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <Avatar name={c.author ?? "?"} size={26} />
                    <div className="min-w-0 flex-1 rounded-[10px] bg-muted px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-medium">{c.author}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(c.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                    </div>
                  </div>
                ))}
                {comments?.length === 0 && (
                  <p className="py-2 text-[13px] text-muted-foreground">No comments yet.</p>
                )}
              </div>

              <form className="mt-3 flex gap-2" onSubmit={submitComment}>
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a comment…"
                  aria-label="New comment"
                />
                <Button type="submit" size="icon" disabled={addComment.isPending} aria-label="Send comment">
                  {addComment.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                </Button>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
