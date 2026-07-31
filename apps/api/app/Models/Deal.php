<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Deal extends Model
{
    use BelongsToTenant, SoftDeletes;

    public const STAGES = ['qualification', 'proposal', 'negotiation', 'won', 'lost'];

    protected $fillable = [
        'tenant_id', 'client_id', 'title', 'value', 'stage', 'position',
        'expected_close', 'closed_at', 'owner_id',
    ];

    protected $attributes = [
        'stage' => 'qualification',
        'value' => 0,
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'expected_close' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(CrmActivity::class);
    }
}
