"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, Select } from "@/components/ui/dialog";
import {
  useAddTaskComment,
  useTaskComments,
  useUpdateTask,
  type TaskRow,
} from "@/hooks/use-api";
import { priorityVariant } from "./task-card";
import { formatDate } from "@/lib/utils";

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
  const [body, setBody] = useState("");

  if (!task) return null;

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    addComment.mutate({ taskId: task.id, body }, { onSuccess: () => setBody("") });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={task.title} className="max-w-lg">
        <div className="space-y-4">
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
            {task.due_date && <Badge variant="neutral">Due {formatDate(task.due_date)}</Badge>}
            <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
          </div>

          {task.description && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
          )}

          {task.assignees.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">Assignees</span>
              <div className="flex -space-x-1.5">
                {task.assignees.map((a) => (
                  <Avatar key={a.id} name={a.name} size={24} className="ring-2 ring-surface-elevated" />
                ))}
              </div>
            </div>
          )}

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
      </DialogContent>
    </Dialog>
  );
}
