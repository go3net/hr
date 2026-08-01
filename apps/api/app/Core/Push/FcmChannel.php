<?php

namespace App\Core\Push;

use App\Models\DeviceToken;
use Illuminate\Notifications\Notification;

/**
 * Notification channel that fans a notification out to every registered
 * device of the notifiable, pruning tokens FCM reports as dead.
 */
class FcmChannel
{
    public function __construct(private readonly FcmGateway $gateway)
    {
    }

    public function send(object $notifiable, Notification $notification): void
    {
        if (! $this->gateway->isConfigured() || ! method_exists($notification, 'toDatabase')) {
            return;
        }

        $payload = $notification->toDatabase($notifiable);
        $tokens = DeviceToken::withoutGlobalScopes()
            ->where('user_id', $notifiable->id)
            ->get();

        foreach ($tokens as $token) {
            $result = $this->gateway->send(
                $token->token,
                $payload['title'] ?? 'Go3net Office',
                $payload['body'] ?? '',
                ['url' => $payload['url'] ?? '/', 'kind' => $payload['kind'] ?? 'general'],
            );

            if ($result === 'invalid') {
                $token->delete();
            } elseif ($result === 'sent') {
                $token->update(['last_seen_at' => now()]);
            }
        }
    }
}
