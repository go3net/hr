<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Objective extends Model
{
    use BelongsToTenant;

    public const STATUSES = ['active', 'completed', 'cancelled'];

    protected $fillable = [
        'tenant_id', 'employee_id', 'title', 'description',
        'period', 'status', 'created_by',
    ];

    protected $attributes = ['status' => 'active'];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function keyResults(): HasMany
    {
        return $this->hasMany(KeyResult::class);
    }

    /** Average key-result completion, capped at 100 per KR. */
    public function progress(): int
    {
        $results = $this->relationLoaded('keyResults') ? $this->keyResults : $this->keyResults()->get();
        if ($results->isEmpty()) {
            return $this->status === 'completed' ? 100 : 0;
        }

        $sum = $results->sum(fn (KeyResult $kr) => $kr->completion());

        return (int) round($sum / $results->count());
    }
}
