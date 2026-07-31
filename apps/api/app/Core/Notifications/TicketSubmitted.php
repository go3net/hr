<?php

namespace App\Core\Notifications;

class TicketSubmitted extends AppNotification
{
    public function __construct(string $number, string $subject, string $byName)
    {
        parent::__construct(
            "New ticket {$number}",
            "{$byName} opened \u{201C}{$subject}\u{201D}.",
            '/helpdesk',
            'ticket',
        );
    }
}
