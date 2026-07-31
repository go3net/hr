<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExitTask extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'exit_id', 'title', 'status', 'completed_at', 'position',
    ];

    protected $attributes = ['status' => 'pending'];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }

    public function exit(): BelongsTo
    {
        return $this->belongsTo(EmployeeExit::class, 'exit_id');
    }
}
