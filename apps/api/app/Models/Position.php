<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Position extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'department_id', 'title', 'level'];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
