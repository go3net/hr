<?php

namespace App\Core\Notifications;

use App\Core\Push\FcmChannel;
use App\Core\Push\FcmGateway;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Base for all product notifications: a title, a body, and a link.
 * Delivered in-app (database) and by email; both queue off the request.
 */
abstract class AppNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $title,
        public readonly string $body,
        public readonly string $url,
        public readonly string $kind, // task|leave|payroll|system — drives the icon client-side
    ) {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        $channels = ['database', 'mail'];

        // Push rides along whenever FCM is configured and the user has a
        // registered device — evaluated at send time, on the queue.
        if (app(FcmGateway::class)->isConfigured()
            && \App\Models\DeviceToken::withoutGlobalScopes()->where('user_id', $notifiable->id)->exists()) {
            $channels[] = FcmChannel::class;
        }

        return $channels;
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'body' => $this->body,
            'url' => $this->url,
            'kind' => $this->kind,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject($this->title)
            ->greeting("Hi {$notifiable->name},")
            ->line($this->body)
            ->action('Open in Go3net Office', rtrim(config('app.frontend_url', config('app.url')), '/').$this->url)
            ->salutation('— Go3net Office');
    }
}
