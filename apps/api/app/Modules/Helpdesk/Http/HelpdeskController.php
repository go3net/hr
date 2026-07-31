<?php

namespace App\Modules\Helpdesk\Http;

use App\Core\Http\ApiController;
use App\Core\Notifications\TicketReplied;
use App\Core\Notifications\TicketSubmitted;
use App\Models\AuditLog;
use App\Models\Ticket;
use App\Models\TicketComment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class HelpdeskController extends ApiController
{
    /** Agents (helpdesk.manage) see every ticket; everyone else sees their own. */
    public function index(Request $request): JsonResponse
    {
        $isAgent = Gate::allows('permission', ['helpdesk.manage']);

        $tickets = Ticket::query()
            ->with(['requester:id,name', 'assignee:id,name'])
            ->withCount('comments')
            ->when(! $isAgent, fn ($q) => $q->where('requester_id', $request->user()->id))
            ->when($request->query('filter.status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (Ticket $t) => $this->present($t));

        return $this->respond($tickets, meta: [
            'is_agent' => $isAgent,
            'open_count' => Ticket::query()->whereIn('status', ['open', 'in_progress', 'waiting'])
                ->when(! $isAgent, fn ($q) => $q->where('requester_id', $request->user()->id))
                ->count(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:200'],
            'description' => ['required', 'string', 'max:8000'],
            'priority' => ['nullable', 'in:'.implode(',', Ticket::PRIORITIES)],
            'category' => ['nullable', 'in:'.implode(',', Ticket::CATEGORIES)],
        ]);

        $user = $request->user();

        $ticket = DB::transaction(fn () => Ticket::create([
            ...$data,
            'number' => Ticket::nextNumber($user->tenant_id),
            'requester_id' => $user->id,
        ]));

        AuditLog::record('helpdesk.ticket_created', $ticket, ['subject' => $ticket->subject]);

        $this->agentsExcept($user)->each(
            fn (User $agent) => $agent->notify(new TicketSubmitted($ticket->number, $ticket->subject, $user->name)),
        );

        return $this->respond($this->present($ticket->load('requester:id,name')), 201);
    }

    public function show(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizeView($request, $ticket);
        $isAgent = Gate::allows('permission', ['helpdesk.manage']);

        $ticket->load(['requester:id,name', 'assignee:id,name']);
        $comments = $ticket->comments()
            ->with('user:id,name')
            ->when(! $isAgent, fn ($q) => $q->where('is_internal', false))
            ->orderBy('created_at')
            ->get()
            ->map(fn (TicketComment $c) => [
                'id' => $c->id,
                'author' => $c->user?->name,
                'author_id' => $c->user_id,
                'body' => $c->body,
                'is_internal' => $c->is_internal,
                'at' => $c->created_at->toIso8601String(),
            ]);

        return $this->respond([...$this->present($ticket), 'comments' => $comments]);
    }

    /** Status, priority, assignment — agents only, except requesters may close their own. */
    public function update(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizeView($request, $ticket);

        $data = $request->validate([
            'status' => ['sometimes', 'in:'.implode(',', Ticket::STATUSES)],
            'priority' => ['sometimes', 'in:'.implode(',', Ticket::PRIORITIES)],
            'category' => ['sometimes', 'nullable', 'in:'.implode(',', Ticket::CATEGORIES)],
            'assignee_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        $isAgent = Gate::allows('permission', ['helpdesk.manage']);
        $requesterClosingOwn = ! $isAgent
            && $ticket->requester_id === $request->user()->id
            && array_keys($data) === ['status']
            && $data['status'] === 'closed';

        if (! $isAgent && ! $requesterClosingOwn) {
            $this->requirePermission('helpdesk.manage');
        }

        if (array_key_exists('assignee_id', $data) && $data['assignee_id'] !== null) {
            $assignee = User::query()->where('tenant_id', $ticket->tenant_id)->find($data['assignee_id']);
            if (! $assignee) {
                return $this->respondError('VALIDATION', 'Assignee not found in this workspace.', 422);
            }
        }

        if (($data['status'] ?? null) === 'resolved' && $ticket->status !== 'resolved') {
            $data['resolved_at'] = now();
        }
        if (($data['status'] ?? null) === 'closed' && $ticket->status !== 'closed') {
            $data['closed_at'] = now();
        }

        $ticket->update($data);
        AuditLog::record('helpdesk.ticket_updated', $ticket, $data);

        return $this->respond($this->present($ticket->fresh(['requester:id,name', 'assignee:id,name'])));
    }

    public function addComment(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizeView($request, $ticket);
        $isAgent = Gate::allows('permission', ['helpdesk.manage']);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:8000'],
            'is_internal' => ['sometimes', 'boolean'],
        ]);

        $comment = TicketComment::create([
            'ticket_id' => $ticket->id,
            'user_id' => $request->user()->id,
            'body' => $data['body'],
            'is_internal' => $isAgent && ($data['is_internal'] ?? false),
        ]);

        // A public agent reply notifies the requester; a requester reply
        // notifies the assignee (or all agents when unassigned).
        if (! $comment->is_internal) {
            if ($request->user()->id !== $ticket->requester_id) {
                $ticket->requester?->notify(new TicketReplied($ticket->number, $request->user()->name));
            } elseif ($ticket->assignee) {
                $ticket->assignee->notify(new TicketReplied($ticket->number, $request->user()->name));
            } else {
                $this->agentsExcept($request->user())->each(
                    fn (User $agent) => $agent->notify(new TicketReplied($ticket->number, $request->user()->name)),
                );
            }
        }

        return $this->respond([
            'id' => $comment->id,
            'author' => $request->user()->name,
            'author_id' => $request->user()->id,
            'body' => $comment->body,
            'is_internal' => $comment->is_internal,
            'at' => $comment->created_at->toIso8601String(),
        ], 201);
    }

    private function authorizeView(Request $request, Ticket $ticket): void
    {
        if ($ticket->requester_id !== $request->user()->id) {
            $this->requirePermission('helpdesk.manage');
        }
    }

    private function agentsExcept(User $user): \Illuminate\Support\Collection
    {
        return User::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('id', '!=', $user->id)
            ->whereHas('roles.permissions', fn ($q) => $q->where('key', 'helpdesk.manage'))
            ->get();
    }

    private function present(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'number' => $ticket->number,
            'subject' => $ticket->subject,
            'description' => $ticket->description,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'category' => $ticket->category,
            'requester' => $ticket->requester?->name,
            'requester_id' => $ticket->requester_id,
            'assignee' => $ticket->assignee?->name,
            'assignee_id' => $ticket->assignee_id,
            'comments_count' => $ticket->comments_count ?? null,
            'created_at' => $ticket->created_at->toIso8601String(),
            'updated_at' => $ticket->updated_at->toIso8601String(),
        ];
    }
}
