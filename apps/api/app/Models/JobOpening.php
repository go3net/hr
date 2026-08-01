<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JobOpening extends Model
{
    use BelongsToTenant;

    public const STATUSES = ['draft', 'open', 'closed'];

    protected $fillable = [
        'tenant_id', 'title', 'department_id', 'employment_type',
        'description', 'status', 'openings_count', 'created_by',
    ];

    protected $attributes = ['status' => 'open', 'openings_count' => 1];

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function applicants(): HasMany
    {
        return $this->hasMany(JobApplicant::class);
    }
}
