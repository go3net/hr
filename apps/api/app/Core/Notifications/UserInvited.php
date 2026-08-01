<?php

namespace App\Core\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Mail-only: the recipient has no usable account yet. */
class UserInvited extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly string $companyName,
        private readonly string $inviterName,
        private readonly string $token,
    ) {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url', config('app.url')), '/')
            .'/accept-invite?token='.$this->token;

        return (new MailMessage())
            ->subject("You've been invited to {$this->companyName} on Go3net Office")
            ->greeting("Hi {$notifiable->name},")
            ->line("{$this->inviterName} has invited you to join {$this->companyName}'s workspace on Go3net Office.")
            ->line('Click below to choose your password and activate your account. The link is valid for 7 days.')
            ->action('Set up my account', $url)
            ->line('If you were not expecting this invitation, you can ignore this email.')
            ->salutation('— Go3net Office');
    }
}
