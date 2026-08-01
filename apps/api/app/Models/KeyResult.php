<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KeyResult extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'objective_id', 'title', 'target_value', 'current_value', 'unit',
    ];

    protected function casts(): array
    {
        return [
            'target_value' => 'decimal:2',
            'current_value' => 'decimal:2',
        ];
    }

    public function objective(): BelongsTo
    {
        return $this->belongsTo(Objective::class);
    }

    /** 0-100, capped. */
    public function completion(): int
    {
        if ((float) $this->target_value <= 0) {
            return 0;
        }

        return (int) min(100, round(((float) $this->current_value / (float) $this->target_value) * 100));
    }
}
