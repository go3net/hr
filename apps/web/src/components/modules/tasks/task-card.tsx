"use client";

import { MessageSquare, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { TaskRow } from "@/hooks/use-api";
import { formatDate } from "@/lib/utils";

export const priorityVariant = {
  low: "neutral",
  medium: "primary",
  high: "warning",
  urgent: "danger",
} as const;

export function TaskCard({
  task,
  onClick,
  draggable = false,
  onDragStart,
}: {
  task: TaskRow;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="cursor-pointer rounded-[12px] border border-border bg-surface p-3 shadow-card transition-all duration-150 hover:shadow-pop active:rotate-[0.6deg] active:shadow-pop"
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge variant={priorityVariant[task.priority]}>{task.priority}</Badge>
          {task.comments_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
              <MessageSquare className="size-3.5" strokeWidth={1.75} />
              {task.comments_count}
            </span>
          )}
          {task.due_date && (
            <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-muted-foreground">
              <CalendarClock className="size-3.5" strokeWidth={1.75} />
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((a) => (
            <Avatar key={a.id} name={a.name} size={22} className="ring-2 ring-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
