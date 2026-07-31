<?php

namespace App\Modules\Calendar\Http;

use App\Core\Http\ApiController;
use App\Core\Notifications\EventInvited;
use App\Models\AuditLog;
use App\Models\CalendarEvent;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class CalendarController extends ApiController
{
    /**
     * Events overlapping [from, to] that the user can see: ones they
     * organize, ones they're invited to, and company-wide events.
     */
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after:from'],
        ]);

        $events = $this->visibleTo($request->user())
            ->where('starts_at', '<', Carbon::parse($data['to']))
            ->where('ends_at', '>', Carbon::parse($data['from']))
            ->with(['organizer:id,name', 'attendees:id,name'])
            ->orderBy('starts_at')
            ->limit(500)
            ->get()
            ->map(fn (CalendarEvent $e) => $this->present($e, $request->user()));

        return $this->respond($events);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:4000'],
            'location' => ['nullable', 'string', 'max:200'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'all_day' => ['sometimes', 'boolean'],
            'kind' => ['nullable', 'in:'.implode(',', CalendarEvent::KINDS)],
            'attendee_ids' => ['sometimes', 'array', 'max:100'],
            'attendee_ids.*' => ['integer'],
        ]);

        // Company-wide events broadcast to everyone — gated.
        if (($data['kind'] ?? null) === 'company') {
            $this->requirePermission('calendar.manage');
        }

        $user = $request->user();
        $attendeeIds = collect($data['attendee_ids'] ?? [])
            ->reject(fn (int $id) => $id === $user->id)
            ->unique()
            ->values();

        if ($attendeeIds->isNotEmpty()) {
            $valid = User::query()
                ->where('tenant_id', $user->tenant_id)
                ->whereIn('id', $attendeeIds)
                ->pluck('id');
            if ($valid->count() !== $attendeeIds->count()) {
                return $this->respondError('VALIDATION', 'One or more attendees were not found in this workspace.', 422);
            }
        }

        $event = CalendarEvent::create([
            ...collect($data)->except('attendee_ids')->all(),
            'organizer_id' => $user->id,
        ]);
        $event->attendees()->sync($attendeeIds);

        AuditLog::record('calendar.event_created', $event, ['title' => $event->title]);

        $when = $event->starts_at->format('D j M, H:i');
        User::query()->whereIn('id', $attendeeIds)->get()->each(
            fn (User $attendee) => $attendee->notify(new EventInvited($event->title, $user->name, $when)),
        );

        return $this->respond($this->present($event->load(['organizer:id,name', 'attendees:id,name']), $user), 201);
    }

    public function update(Request $request, CalendarEvent $event): JsonResponse
    {
        $this->authorizeOrganizer($request, $event);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'location' => ['sometimes', 'nullable', 'string', 'max:200'],
            'starts_at' => ['sometimes', 'date'],
            'ends_at' => ['sometimes', 'date'],
            'all_day' => ['sometimes', 'boolean'],
            'kind' => ['sometimes', 'in:'.implode(',', CalendarEvent::KINDS)],
        ]);

        if (($data['kind'] ?? null) === 'company' && $event->kind !== 'company') {
            $this->requirePermission('calendar.manage');
        }

        $starts = isset($data['starts_at']) ? Carbon::parse($data['starts_at']) : $event->starts_at;
        $ends = isset($data['ends_at']) ? Carbon::parse($data['ends_at']) : $event->ends_at;
        if ($ends->lte($starts)) {
            return $this->respondError('VALIDATION', 'The event must end after it starts.', 422);
        }

        $event->update($data);

        return $this->respond($this->present($event->fresh(['organizer:id,name', 'attendees:id,name']), $request->user()));
    }

    public function destroy(Request $request, CalendarEvent $event): JsonResponse
    {
        $this->authorizeOrganizer($request, $event);

        AuditLog::record('calendar.event_deleted', $event, ['title' => $event->title]);
        $event->delete();

        return $this->respond(null, 204);
    }

    /** Attendee RSVP. */
    public function rsvp(Request $request, CalendarEvent $event): JsonResponse
    {
        $data = $request->validate([
            'response' => ['required', 'in:accepted,declined'],
        ]);

        $user = $request->user();
        if (! $event->attendees()->whereKey($user->id)->exists()) {
            return $this->respondError('FORBIDDEN', 'You are not invited to this event.', 403);
        }

        $event->attendees()->updateExistingPivot($user->id, ['response' => $data['response']]);

        return $this->respond($this->present($event->fresh(['organizer:id,name', 'attendees:id,name']), $user));
    }

    /** iCalendar export of the next 12 months — importable into Google/Outlook. */
    public function export(Request $request): Response
    {
        $events = $this->visibleTo($request->user())
            ->where('ends_at', '>', now())
            ->where('starts_at', '<', now()->addMonths(12))
            ->orderBy('starts_at')
            ->limit(500)
            ->get();

        $lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Go3net Office//Calendar//EN',
            'CALSCALE:GREGORIAN',
        ];

        foreach ($events as $event) {
            $lines = [...$lines,
                'BEGIN:VEVENT',
                "UID:g3n-event-{$event->id}@go3net.app",
                'DTSTAMP:'.$event->updated_at->utc()->format('Ymd\THis\Z'),
                'DTSTART:'.$event->starts_at->utc()->format('Ymd\THis\Z'),
                'DTEND:'.$event->ends_at->utc()->format('Ymd\THis\Z'),
                'SUMMARY:'.$this->icsEscape($event->title),
                ...($event->location ? ['LOCATION:'.$this->icsEscape($event->location)] : []),
                ...($event->description ? ['DESCRIPTION:'.$this->icsEscape($event->description)] : []),
                'END:VEVENT',
            ];
        }
        $lines[] = 'END:VCALENDAR';

        return response(implode("\r\n", $lines), 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="go3net-calendar.ics"',
        ]);
    }

    private function visibleTo(User $user): \Illuminate\Database\Eloquent\Builder
    {
        return CalendarEvent::query()->where(fn ($q) => $q
            ->where('organizer_id', $user->id)
            ->orWhere('kind', 'company')
            ->orWhereHas('attendees', fn ($a) => $a->whereKey($user->id)));
    }

    private function authorizeOrganizer(Request $request, CalendarEvent $event): void
    {
        if ($event->organizer_id !== $request->user()->id
            && ! Gate::allows('permission', ['calendar.manage'])) {
            abort(403, 'Only the organizer can change this event.');
        }
    }

    private function icsEscape(string $value): string
    {
        return str_replace(["\\", ";", ",", "\n"], ["\\\\", '\;', '\,', '\n'], $value);
    }

    private function present(CalendarEvent $event, User $viewer): array
    {
        return [
            'id' => $event->id,
            'title' => $event->title,
            'description' => $event->description,
            'location' => $event->location,
            'starts_at' => $event->starts_at->toIso8601String(),
            'ends_at' => $event->ends_at->toIso8601String(),
            'all_day' => $event->all_day,
            'kind' => $event->kind,
            'organizer' => $event->organizer?->name,
            'is_organizer' => $event->organizer_id === $viewer->id,
            'my_response' => $event->relationLoaded('attendees')
                ? $event->attendees->firstWhere('id', $viewer->id)?->pivot?->response
                : null,
            'attendees' => $event->relationLoaded('attendees')
                ? $event->attendees->map(fn (User $a) => [
                    'id' => $a->id,
                    'name' => $a->name,
                    'response' => $a->pivot->response,
                ])->values()
                : [],
        ];
    }
}
