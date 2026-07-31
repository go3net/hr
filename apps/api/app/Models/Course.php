<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Course extends Model
{
    use BelongsToTenant;

    public const CATEGORIES = ['onboarding', 'compliance', 'technical', 'soft_skills', 'other'];

    protected $fillable = [
        'tenant_id', 'title', 'description', 'category', 'status',
        'created_by', 'published_at',
    ];

    protected $attributes = ['status' => 'draft'];

    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class)->orderBy('position');
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }
}
