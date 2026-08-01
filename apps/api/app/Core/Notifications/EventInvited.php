<?php

namespace App\Core\Notifications;

class EventInvited extends AppNotification
{
    public function __construct(string $title, string $byName, string $when)
    {
        parent::__construct(
            'Calendar invite',
            "{$byName} invited you to \u{201C}{$title}\u{201D} ({$when}).",
            '/calendar',
            'calendar',
        );
    }
}
