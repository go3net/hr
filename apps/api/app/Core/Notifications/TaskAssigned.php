<?php

namespace App\Core\Notifications;

class TaskAssigned extends AppNotification
{
    public function __construct(string $taskTitle, string $byName, string $url)
    {
        parent::__construct(
            'You were assigned a task',
            "{$byName} assigned you \u{201C}{$taskTitle}\u{201D}.",
            $url,
            'task',
        );
    }
}
