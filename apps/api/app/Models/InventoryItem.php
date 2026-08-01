<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    use BelongsToTenant;

    public const CATEGORIES = ['equipment', 'consumables', 'furniture', 'stock', 'other'];

    protected $fillable = [
        'tenant_id', 'name', 'sku', 'category', 'unit', 'quantity',
        'reorder_level', 'unit_cost', 'location',
    ];

    protected $attributes = ['quantity' => 0, 'reorder_level' => 0, 'unit' => 'unit'];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'reorder_level' => 'decimal:2',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function isLowStock(): bool
    {
        return (float) $this->reorder_level > 0
            && (float) $this->quantity <= (float) $this->reorder_level;
    }
}
