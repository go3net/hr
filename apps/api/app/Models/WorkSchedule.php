<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class WorkSchedule extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'name', 'starts_at', 'ends_at', 'grace_minutes', 'work_days'];

    protected function casts(): array
    {
        return ['work_days' => 'array'];
    }
}
