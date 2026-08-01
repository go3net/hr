<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CompanyAsset extends Model
{
    use BelongsToTenant;

    public const CATEGORIES = ['laptop', 'phone', 'monitor', 'furniture', 'vehicle', 'other'];

    public const STATUSES = ['available', 'assigned', 'maintenance', 'retired'];

    protected $fillable = [
        'tenant_id', 'name', 'tag', 'category', 'serial_number',
        'status', 'assigned_employee_id', 'assigned_at', 'notes',
    ];

    protected $attributes = ['status' => 'available', 'category' => 'laptop'];

    protected function casts(): array
    {
        return ['assigned_at' => 'datetime'];
    }

    public function assignedEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'assigned_employee_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(AssetAssignment::class);
    }
}
