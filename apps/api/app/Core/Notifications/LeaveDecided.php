<?php

namespace App\Core\Notifications;

class LeaveDecided extends AppNotification
{
    public function __construct(string $type, string $decision, ?string $note = null)
    {
        parent::__construct(
            "Leave request {$decision}",
            trim("Your {$type} leave request was {$decision}.".($note ? " Note: {$note}" : '')),
            '/hr/leave',
            'leave',
        );
    }
}
