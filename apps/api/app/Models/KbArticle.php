<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class KbArticle extends Model
{
    use BelongsToTenant;

    public const CATEGORIES = ['policies', 'how_to', 'onboarding', 'it', 'benefits', 'other'];

    protected $fillable = [
        'tenant_id', 'title', 'slug', 'category', 'body', 'status',
        'author_id', 'published_at', 'views',
    ];

    protected $attributes = ['status' => 'draft'];

    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    /** Unique-per-tenant slug derived from the title. */
    public static function slugFor(int $tenantId, string $title): string
    {
        $base = Str::slug(Str::limit($title, 180, '')) ?: 'article';
        $slug = $base;
        $n = 2;
        while (static::withoutGlobalScopes()->where('tenant_id', $tenantId)->where('slug', $slug)->exists()) {
            $slug = "{$base}-{$n}";
            $n++;
        }

        return $slug;
    }
}
