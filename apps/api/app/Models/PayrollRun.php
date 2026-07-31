<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'period', 'status', 'gross_total', 'net_total',
        'created_by', 'approved_by', 'approved_at', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'gross_total' => 'decimal:2',
            'net_total' => 'decimal:2',
            'approved_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(PayrollItem::class);
    }
}
