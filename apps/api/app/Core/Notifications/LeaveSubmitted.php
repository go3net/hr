<?php

namespace App\Core\Notifications;

class LeaveSubmitted extends AppNotification
{
    public function __construct(string $employeeName, string $type, string $range)
    {
        parent::__construct(
            'Leave request awaiting approval',
            "{$employeeName} requested {$type} leave ({$range}).",
            '/hr/leave',
            'leave',
        );
    }
}
