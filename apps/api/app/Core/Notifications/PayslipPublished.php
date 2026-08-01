<?php

namespace App\Core\Notifications;

class PayslipPublished extends AppNotification
{
    public function __construct(string $period)
    {
        parent::__construct(
            'Your payslip is ready',
            "Your payslip for {$period} has been published.",
            '/hr/payroll',
            'payroll',
        );
    }
}
