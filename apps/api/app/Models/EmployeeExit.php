<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployeeExit extends Model
{
    use BelongsToTenant;

    protected $table = 'exits';

    public const REASONS = ['resignation', 'termination', 'retirement', 'contract_end', 'other'];

    protected $fillable = [
        'tenant_id', 'employee_id', 'reason', 'notice_date', 'last_working_day',
        'status', 'notes', 'initiated_by', 'completed_at',
    ];

    protected $attributes = ['status' => 'clearance'];

    protected function casts(): array
    {
        return [
            'notice_date' => 'date',
            'last_working_day' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(ExitTask::class, 'exit_id')->orderBy('position');
    }
}
