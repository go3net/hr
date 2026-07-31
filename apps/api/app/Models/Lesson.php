<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lesson extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'course_id', 'title', 'content', 'position', 'duration_minutes',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
