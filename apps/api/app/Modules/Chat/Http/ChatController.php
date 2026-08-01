<?php

namespace App\Modules\Chat\Http;

use App\Core\Http\ApiController;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Modules\Chat\Events\MessageSent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ChatController extends ApiController
{
    /** The caller's conversations, most recent activity first. */
    public function conversations(Request $request): JsonResponse
    {
        $user = $request->user();

        $conversations = Conversation::query()
            ->whereHas('participants', fn ($q) => $q->where('users.id', $user->id))
            ->with(['participants:id,name', 'lastMessage.author:id,name'])
            ->orderByDesc('last_message_at')
            ->limit(50)
            ->get()
            ->map(function (Conversation $c) use ($user) {
                $me = $c->participants->firstWhere('id', $user->id);
                $lastRead = $me?->pivot?->last_read_at;

                $unread = Message::query()
                    ->where('conversation_id', $c->id)
                    ->where('user_id', '!=', $user->id)
                    ->when($lastRead, fn ($q) => $q->where('created_at', '>', $lastRead))
                    ->count();

                return [
                    'id' => $c->id,
                    'type' => $c->type,
                    'name' => $c->displayNameFor($user),
                    'participants' => $c->participants->map(fn ($p) => ['id' => $p->id, 'name' => $p->name]),
                    'last_message' => $c->lastMessage ? [
                        'author' => $c->lastMessage->author?->name,
                        'body' => str($c->lastMessage->body)->limit(80)->toString(),
                        'at' => $c->lastMessage->created_at->toIso8601String(),
                    ] : null,
                    'unread' => $unread,
                ];
            });

        return $this->respond($conversations);
    }

    /** Start a direct or group conversation; directs dedupe to existing. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:direct,group'],
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer'],
            'name' => ['required_if:type,group', 'nullable', 'string', 'max:120'],
        ]);

        $user = $request->user();
        $others = User::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('id', '!=', $user->id)
            ->whereIn('id', $data['user_ids'])
            ->pluck('id');

        if ($others->isEmpty()) {
            throw ValidationException::withMessages(['user_ids' => 'Pick at least one other person.']);
        }

        if ($data['type'] === 'direct') {
            $otherId = $others->first();

            $existing = Conversation::query()
                ->where('type', 'direct')
                ->whereHas('participants', fn ($q) => $q->where('users.id', $user->id))
                ->whereHas('participants', fn ($q) => $q->where('users.id', $otherId))
                ->first();

            if ($existing) {
                return $this->respond(['id' => $existing->id, 'existing' => true]);
            }
        }

        $conversation = DB::transaction(function () use ($data, $user, $others) {
            $conversation = Conversation::create([
                'type' => $data['type'],
                'name' => $data['type'] === 'group' ? $data['name'] : null,
                'created_by' => $user->id,
                'last_message_at' => now(),
            ]);

            $conversation->participants()->attach([$user->id, ...$others->all()]);

            return $conversation;
        });

        return $this->respond(['id' => $conversation->id, 'existing' => false], 201);
    }

    public function messages(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->hasParticipant($request->user()), 404);

        $messages = $conversation->messages()
            ->with('author:id,name')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (Message $m) => $this->present($m));

        return $this->respond($messages);
    }

    public function send(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->hasParticipant($request->user()), 404);

        $data = $request->validate(['body' => ['required', 'string', 'max:5000']]);

        $message = $conversation->messages()->create([
            'user_id' => $request->user()->id,
            'body' => $data['body'],
        ]);

        $conversation->update(['last_message_at' => now()]);
        $conversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);

        broadcast(new MessageSent($message->load('author:id,name')))->toOthers();

        return $this->respond($this->present($message), 201);
    }

    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->hasParticipant($request->user()), 404);

        $conversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);

        return $this->respond(['read' => true]);
    }

    private function present(Message $m): array
    {
        return [
            'id' => $m->id,
            'conversation_id' => $m->conversation_id,
            'author' => $m->relationLoaded('author') ? $m->author?->name : null,
            'author_id' => $m->user_id,
            'body' => $m->body,
            'at' => $m->created_at->toIso8601String(),
        ];
    }
}
