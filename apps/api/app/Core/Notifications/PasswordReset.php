<?php

namespace App\Core\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A short-lived, single-use link generated and stored by Laravel's password broker. */
class PasswordReset extends Notification
{
    use Queueable;

    public function __construct(public readonly string $token)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url', config('app.url')), '/')
            .'/reset-password?token='.urlencode($this->token)
            .'&email='.urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage())
            ->subject('Reset your Go3net Office password')
            ->greeting("Hi {$notifiable->name},")
            ->line('We received a request to reset your Go3net Office password.')
            ->action('Reset password', $url)
            ->line('This link expires in 60 minutes and can be used once.')
            ->line('If you did not request a password reset, no further action is needed.');
    }
}
