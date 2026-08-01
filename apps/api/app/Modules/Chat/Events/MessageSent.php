<?php

namespace App\Modules\Chat\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly Message $message)
    {
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel(
            "tenant.{$this->message->tenant_id}.conversation.{$this->message->conversation_id}",
        );
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'author' => $this->message->author?->name,
            'author_id' => $this->message->user_id,
            'body' => $this->message->body,
            'at' => $this->message->created_at->toIso8601String(),
        ];
    }
}
