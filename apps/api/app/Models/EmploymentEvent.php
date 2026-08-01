<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmploymentEvent extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'employee_id', 'type', 'title', 'notes', 'occurred_on', 'recorded_by'];

    protected function casts(): array
    {
        return ['occurred_on' => 'date'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
