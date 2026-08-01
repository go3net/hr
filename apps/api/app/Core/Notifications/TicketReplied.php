<?php

namespace App\Core\Notifications;

class TicketReplied extends AppNotification
{
    public function __construct(string $number, string $byName)
    {
        parent::__construct(
            "Reply on ticket {$number}",
            "{$byName} replied to your ticket {$number}.",
            '/helpdesk',
            'ticket',
        );
    }
}
