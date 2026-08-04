<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaveType extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'name', 'days_per_year', 'requires_approval', 'is_paid'];

    public function requests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    protected function casts(): array
    {
        return [
            'requires_approval' => 'boolean',
            'is_paid' => 'boolean',
        ];
    }
}
