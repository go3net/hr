<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
 * Private channel auth. Channel names are tenant-prefixed; membership is
 * checked against the authenticated user, never trusted from the client.
 */

Broadcast::channel('tenant.{tenantId}.conversation.{conversationId}', function (User $user, int $tenantId, int $conversationId) {
    if ($user->tenant_id !== $tenantId) {
        return false;
    }

    $conversation = Conversation::query()
        ->withoutGlobalScopes()
        ->where('tenant_id', $tenantId)
        ->find($conversationId);

    return $conversation?->hasParticipant($user) ?? false;
});

Broadcast::channel('tenant.{tenantId}.user.{userId}', function (User $user, int $tenantId, int $userId) {
    return $user->tenant_id === $tenantId && $user->id === $userId;
});
