<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveBalance extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'employee_id', 'leave_type_id', 'year', 'entitled_days', 'used_days',
    ];

    protected function casts(): array
    {
        return [
            'entitled_days' => 'decimal:1',
            'used_days' => 'decimal:1',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }

    public function remainingDays(): float
    {
        return (float) $this->entitled_days - (float) $this->used_days;
    }
}
