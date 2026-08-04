"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input, Label } from "@/components/ui/input";
import { Dialog, DialogContent, Select } from "@/components/ui/dialog";
import {
  type CalendarEventRow,
  useBootstrap,
  useCalendarEvents,
  useCreateEvent,
  useDeleteEvent,
  useRsvpEvent,
  useUsers,
} from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const KIND_META: Record<string, { label: string; dot: string }> = {
  meeting: { label: "Meeting", dot: "bg-[var(--primary,#2DA9DD)]" },
  reminder: { label: "Reminder", dot: "bg-[var(--muted-foreground,#64748B)]" },
  deadline: { label: "Deadline", dot: "bg-[var(--warning,#F59E0B)]" },
  company: { label: "Company", dot: "bg-[var(--success,#22C55E)]" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeRange(event: CalendarEventRow): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return event.all_day ? "All day" : `${fmt(event.starts_at)} – ${fmt(event.ends_at)}`;
}

function NewEventDialog({
  open,
  onOpenChange,
  defaultDate,
  canCompany,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  canCompany: boolean;
}) {
  const create = useCreateEvent();
  const { data: users } = useUsers();
  const { data: session } = useBootstrap();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("11:00");
  const [kind, setKind] = useState("meeting");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [attendees, setAttendees] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: number) =>
    setAttendees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = () => {
    setError(null);
    create.mutate(
      {
        title,
        kind,
        location: location || undefined,
        description: description || undefined,
        starts_at: `${date}T${start}:00`,
        ends_at: `${date}T${end}:00`,
        attendee_ids: attendees,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setTitle("");
          setAttendees([]);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Could not create the event."),
      },
    );
  };

  const colleagues = (users ?? []).filter((u) => u.id !== session?.user.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New event" description="Invite colleagues and it lands on their calendar.">
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="e-title">Title</Label>
            <Input id="e-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sprint planning" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-start">From</Label>
              <Input id="e-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-end">To</Label>
              <Input id="e-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="e-kind">Type</Label>
              <Select id="e-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="meeting">Meeting</option>
                <option value="reminder">Reminder</option>
                <option value="deadline">Deadline</option>
                {canCompany ? <option value="company">Company-wide</option> : null}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="e-location">Location</Label>
              <Input id="e-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Boardroom / link" />
            </div>
          </div>
          {kind !== "company" && colleagues.length > 0 ? (
            <div className="grid gap-2">
              <Label>Invite</Label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-[10px] border border-border p-2">
                {colleagues.map((u) => (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={attendees.includes(u.id)}
                      onChange={() => toggle(u.id)}
                      className="size-3.5 accent-[var(--primary,#2DA9DD)]"
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="e-desc">Notes</Label>
            <textarea
              id="e-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-base text-foreground shadow-card sm:text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={create.isPending || title.trim() === ""}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create event
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventDialog({
  event,
  onOpenChange,
}: {
  event: CalendarEventRow;
  onOpenChange: (open: boolean) => void;
}) {
  const rsvp = useRsvpEvent();
  const deleteEvent = useDeleteEvent();
  const dateLabel = new Date(event.starts_at).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent title={event.title}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("size-2 rounded-full", KIND_META[event.kind].dot)} />
            <span className="text-sm text-muted-foreground">{KIND_META[event.kind].label}</span>
            {event.my_response ? (
              <Badge variant={event.my_response === "accepted" ? "success" : event.my_response === "declined" ? "danger" : "warning"}>
                {event.my_response}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-1 text-sm text-foreground">
            <p className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" /> {dateLabel} · {timeRange(event)}</p>
            {event.location ? (
              <p className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /> {event.location}</p>
            ) : null}
            {event.organizer ? (
              <p className="text-[13px] text-muted-foreground">Organized by {event.organizer}</p>
            ) : null}
          </div>
          {event.description ? (
            <p className="whitespace-pre-wrap rounded-[10px] bg-muted/40 p-3 text-sm text-foreground">{event.description}</p>
          ) : null}
          {event.attendees.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-foreground">Attendees</p>
              <div className="flex flex-wrap gap-1.5">
                {event.attendees.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] text-foreground">
                    {a.name}
                    {a.response === "accepted" ? <Check className="size-3 text-success" /> : null}
                    {a.response === "declined" ? <X className="size-3 text-danger" /> : null}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-border pt-3">
            {event.my_response ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={event.my_response === "accepted" ? "primary" : "outline"}
                  onClick={() => rsvp.mutate({ id: event.id, response: "accepted" }, { onSuccess: () => onOpenChange(false) })}
                  disabled={rsvp.isPending}
                >
                  <Check className="size-4" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rsvp.mutate({ id: event.id, response: "declined" }, { onSuccess: () => onOpenChange(false) })}
                  disabled={rsvp.isPending}
                >
                  <X className="size-4" /> Decline
                </Button>
              </div>
            ) : <span />}
            {event.is_organizer ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() => {
                  if (window.confirm("Delete this event for everyone?")) {
                    deleteEvent.mutate(event.id, { onSuccess: () => onOpenChange(false) });
                  }
                }}
                disabled={deleteEvent.isPending}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarClient() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [creating, setCreating] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarEventRow | null>(null);
  const { data: session } = useBootstrap();

  // Monday-start grid spanning the whole month.
  const gridStart = useMemo(() => {
    const first = new Date(cursor);
    const shift = (first.getDay() + 6) % 7;
    first.setDate(first.getDate() - shift);
    return first;
  }, [cursor]);

  const days = useMemo(() => {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const total = Math.ceil(((monthEnd.getTime() - gridStart.getTime()) / 86_400_000 + 1) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [cursor, gridStart]);

  const from = isoDate(days[0]);
  const to = isoDate(new Date(days[days.length - 1].getTime() + 86_400_000));
  const { data: events, isLoading } = useCalendarEvents(from, to);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEventRow[]>();
    for (const event of events ?? []) {
      // Multi-day events appear on each day they span.
      const start = new Date(event.starts_at);
      const end = new Date(event.ends_at);
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
        const key = isoDate(d);
        map.set(key, [...(map.get(key) ?? []), event]);
      }
    }
    return map;
  }, [events]);

  const canCompany =
    (session?.permissions ?? []).includes("*") ||
    (session?.permissions ?? []).includes("calendar.manage");

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const todayKey = isoDate(today);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground">Meetings, deadlines and company events.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/api/backend/calendar/export" download>
              <Download className="size-4" />
              Export .ics
            </a>
          </Button>
          <Button onClick={() => setCreating(todayKey)}>
            <Plus className="size-4" />
            New event
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-3">
          <Button variant="ghost" size="icon" aria-label="Previous month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-foreground">{monthLabel}</h2>
            <Button variant="outline" size="sm"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
              Today
            </Button>
          </div>
          <Button variant="ghost" size="icon" aria-label="Next month"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* Seven columns cannot shrink below readability — scroll the
            grid inside its own container rather than the page. */}
        <div className="overflow-x-auto">
        <div className="min-w-[700px]">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-[12px] font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {isLoading && !events ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }, (_, i) => (
              <Skeleton key={i} className="m-1 h-24 rounded-md" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = isoDate(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const dayEvents = byDay.get(key) ?? [];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCreating(key)}
                  className={cn(
                    "min-h-24 border-b border-r border-border/60 p-1.5 text-left align-top transition hover:bg-muted/30",
                    !inMonth && "bg-muted/20 opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-[12px]",
                      key === todayKey ? "bg-primary font-semibold text-white" : "text-muted-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setSelected(event); }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.stopPropagation(); setSelected(event); }
                        }}
                        className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] text-foreground hover:bg-muted"
                      >
                        <span className={cn("size-1.5 shrink-0 rounded-full", KIND_META[event.kind].dot)} />
                        <span className="truncate">{event.title}</span>
                      </span>
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className="px-1 text-[11px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-4">
        {Object.entries(KIND_META).map(([kind, meta]) => (
          <span key={kind} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className={cn("size-2 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        ))}
      </div>

      {creating !== null ? (
        <NewEventDialog open onOpenChange={(open) => !open && setCreating(null)} defaultDate={creating} canCompany={canCompany} />
      ) : null}
      {selected !== null ? (
        <EventDialog event={selected} onOpenChange={(open) => !open && setSelected(null)} />
      ) : null}
    </div>
  );
}
