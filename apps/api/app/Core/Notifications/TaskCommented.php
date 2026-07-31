<?php

namespace App\Core\Notifications;

class TaskCommented extends AppNotification
{
    public function __construct(string $taskTitle, string $byName, string $url)
    {
        parent::__construct(
            'New comment on a task',
            "{$byName} commented on \u{201C}{$taskTitle}\u{201D}.",
            $url,
            'task',
        );
    }
}
