<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JobApplicant extends Model
{
    use BelongsToTenant;

    public const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

    public const SOURCES = ['referral', 'website', 'linkedin', 'agency', 'other'];

    protected $fillable = [
        'tenant_id', 'job_opening_id', 'name', 'email', 'phone',
        'source', 'stage', 'rating', 'notes', 'hired_employee_id',
    ];

    protected $attributes = ['stage' => 'applied'];

    public function opening(): BelongsTo
    {
        return $this->belongsTo(JobOpening::class, 'job_opening_id');
    }

    public function hiredEmployee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'hired_employee_id');
    }
}
