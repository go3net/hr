"use client";

import { useState } from "react";
import { ArrowLeft, BookOpenCheck, Check, Clock3, GraduationCap, Loader2, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger, Select } from "@/components/ui/dialog";
import {
  type CourseRow,
  useAddLesson,
  useCompleteLesson,
  useCourse,
  useCourses,
  useCreateCourse,
  useEnroll,
  useUpdateCourse,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  compliance: "Compliance",
  technical: "Technical",
  soft_skills: "Soft skills",
  other: "Other",
};

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-[var(--primary,#2DA9DD)] transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function NewCourseDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("onboarding");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateCourse();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New course
        </Button>
      </DialogTrigger>
      <DialogContent title="New course" description="Starts as a draft — publish once lessons are in.">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="c-title">Title</Label>
            <Input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Security Awareness" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-cat">Category</Label>
            <Select id="c-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-desc">Description</Label>
            <textarea
              id="c-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-card focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                create.mutate(
                  { title, category, description: description || undefined },
                  {
                    onSuccess: () => { setOpen(false); setTitle(""); setDescription(""); },
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create the course."),
                  },
                )
              }
              disabled={create.isPending || title.trim() === ""}
            >
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create draft
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddLessonDialog({ courseId }: { courseId: number }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useAddLesson(courseId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          Add lesson
        </Button>
      </DialogTrigger>
      <DialogContent title="Add lesson" className="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="l-title">Title</Label>
              <Input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spotting phishing" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="l-min">Minutes</Label>
              <Input id="l-min" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="l-content">Content (Markdown)</Label>
            <textarea
              id="l-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              className="w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2 font-mono text-[13px] text-foreground shadow-card focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button
              onClick={() =>
                add.mutate(
                  { title, content, duration_minutes: minutes ? Number(minutes) : undefined },
                  {
                    onSuccess: () => { setOpen(false); setTitle(""); setContent(""); setMinutes(""); },
                    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not add the lesson."),
                  },
                )
              }
              disabled={add.isPending || title.trim() === "" || content.trim() === ""}
            >
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Add lesson
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CourseView({ courseId, isManager, onBack }: { courseId: number; isManager: boolean; onBack: () => void }) {
  const { data: course, isLoading } = useCourse(courseId);
  const enroll = useEnroll();
  const complete = useCompleteLesson(courseId);
  const updateCourse = useUpdateCourse();
  const [openLesson, setOpenLesson] = useState<number | null>(null);

  if (isLoading || !course) {
    return <Skeleton className="h-72" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4" />
          All courses
        </Button>
        {isManager ? (
          <div className="flex gap-2">
            <AddLessonDialog courseId={course.id} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateCourse.mutate({ id: course.id, status: course.status === "published" ? "draft" : "published" })}
              disabled={updateCourse.isPending}
            >
              {course.status === "published" ? "Unpublish" : "Publish"}
            </Button>
          </div>
        ) : null}
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          {course.category ? <Badge variant="primary">{CATEGORY_LABELS[course.category] ?? course.category}</Badge> : null}
          {course.status === "draft" ? <Badge variant="warning">Draft</Badge> : null}
          {course.completed ? <Badge variant="success">Completed</Badge> : null}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{course.title}</h1>
        {course.description ? <p className="mt-1 text-sm text-muted-foreground">{course.description}</p> : null}

        {course.enrolled ? (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[12px] text-muted-foreground">
              <span>Your progress</span>
              <span>{course.progress}%</span>
            </div>
            <ProgressBar value={course.progress} />
          </div>
        ) : course.status === "published" ? (
          <Button className="mt-4" onClick={() => enroll.mutate(course.id)} disabled={enroll.isPending}>
            {enroll.isPending ? <Loader2 className="size-4 animate-spin" /> : <GraduationCap className="size-4" />}
            Enroll
          </Button>
        ) : null}
      </Card>

      <div className="space-y-2">
        {course.lessons.map((lesson, index) => (
          <Card key={lesson.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenLesson(openLesson === lesson.id ? null : lesson.id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-medium",
                    lesson.completed ? "bg-[var(--success,#22C55E)] text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {lesson.completed ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{lesson.title}</span>
              </div>
              {lesson.duration_minutes ? (
                <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {lesson.duration_minutes} min
                </span>
              ) : null}
            </button>
            {openLesson === lesson.id ? (
              <div className="border-t border-border p-4">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{lesson.content}</div>
                {course.enrolled && !lesson.completed ? (
                  <Button
                    className="mt-4"
                    size="sm"
                    onClick={() => complete.mutate(lesson.id)}
                    disabled={complete.isPending}
                  >
                    {complete.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Mark complete
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function LmsClient() {
  const { data, isLoading } = useCourses();
  const [selected, setSelected] = useState<number | null>(null);

  const courses = data?.courses ?? [];
  const isManager = data?.isManager ?? false;

  if (selected !== null) {
    return <CourseView courseId={selected} isManager={isManager} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Training</h1>
          <p className="text-sm text-muted-foreground">Courses to grow the team, one lesson at a time.</p>
        </div>
        {isManager ? <NewCourseDialog /> : null}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : courses.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpenCheck className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            {isManager ? "No courses yet — create the first one." : "No courses published yet."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course: CourseRow) => (
            <button
              key={course.id}
              type="button"
              onClick={() => setSelected(course.id)}
              className="flex flex-col rounded-[14px] border border-border bg-surface p-5 text-left shadow-card transition hover:border-primary/40 hover:shadow-pop"
            >
              <div className="flex items-center gap-2">
                {course.category ? <Badge variant="primary">{CATEGORY_LABELS[course.category] ?? course.category}</Badge> : null}
                {course.status === "draft" ? <Badge variant="warning">Draft</Badge> : null}
                {course.completed ? <Badge variant="success">Done</Badge> : null}
              </div>
              <h3 className="mt-2.5 text-[15px] font-semibold text-foreground">{course.title}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-[13px] text-muted-foreground">{course.description}</p>
              <div className="mt-3 space-y-1.5">
                <p className="text-[12px] text-muted-foreground">
                  {course.lessons_count} lesson{course.lessons_count === 1 ? "" : "s"}
                  {course.enrollments_count !== null ? ` · ${course.enrollments_count} enrolled` : ""}
                </p>
                {course.enrolled ? <ProgressBar value={course.progress} /> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
