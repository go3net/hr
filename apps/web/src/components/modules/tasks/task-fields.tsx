"use client";

import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { AssigneePicker } from "./assignee-picker";

export type TaskDraft = {
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string;
  assignee_ids: number[];
};

export const emptyDraft = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
  title: "",
  description: "",
  priority: "medium",
  status: "todo",
  due_date: "",
  assignee_ids: [],
  ...overrides,
});

/** The payload the API expects, with blanks normalised to null. */
export function draftToPayload(draft: TaskDraft, { withStatus = false } = {}) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    priority: draft.priority,
    due_date: draft.due_date || null,
    assignee_ids: draft.assignee_ids,
    ...(withStatus ? { status: draft.status } : {}),
  };
}

/**
 * Shared by the project board and the personal task list so the two forms
 * cannot offer different fields.
 */
export function TaskFields({
  draft,
  onChange,
  idPrefix,
  showStatus = false,
}: {
  draft: TaskDraft;
  onChange: (next: TaskDraft) => void;
  idPrefix: string;
  showStatus?: boolean;
}) {
  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    onChange({ ...draft, [key]: value });

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Design the landing page"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <textarea
          id={`${idPrefix}-description`}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder="What does done look like? Add context, links or acceptance criteria."
          className="w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2 text-base text-foreground shadow-card placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-priority`}>Priority</Label>
          <Select
            id={`${idPrefix}-priority`}
            value={draft.priority}
            onChange={(e) => set("priority", e.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-due`}>Due date</Label>
          <Input
            id={`${idPrefix}-due`}
            type="date"
            value={draft.due_date}
            onChange={(e) => set("due_date", e.target.value)}
          />
        </div>
      </div>

      {showStatus && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-status`}>Status</Label>
          <Select
            id={`${idPrefix}-status`}
            value={draft.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="review">In review</option>
            <option value="done">Done</option>
          </Select>
        </div>
      )}

      <AssigneePicker
        value={draft.assignee_ids}
        onChange={(ids) => set("assignee_ids", ids)}
      />
    </>
  );
}
