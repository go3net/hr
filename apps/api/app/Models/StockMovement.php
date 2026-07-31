<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use BelongsToTenant;

    public const KINDS = ['in', 'out', 'adjust'];

    protected $fillable = [
        'tenant_id', 'inventory_item_id', 'kind', 'quantity', 'note', 'user_id',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:2'];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
