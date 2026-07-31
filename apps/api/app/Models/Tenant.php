<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Tenant extends Model
{
    use SoftDeletes;

    protected $fillable = ['name', 'subdomain', 'custom_domain', 'branding', 'settings', 'status', 'trial_ends_at'];

    protected function casts(): array
    {
        return [
            'branding' => 'array',
            'settings' => 'array',
            'trial_ends_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Tenant $tenant) {
            $tenant->public_id ??= (string) Str::uuid();
        });
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function modules(): BelongsToMany
    {
        return $this->belongsToMany(Module::class, 'tenant_modules')->withPivot('enabled')->withTimestamps();
    }

    public function hasModuleEnabled(string $key): bool
    {
        return $this->modules()
            ->where('key', $key)
            ->wherePivot('enabled', true)
            ->exists();
    }

    /** Enable every module in the catalog for this tenant (used at signup). */
    public function enableAllModules(): void
    {
        $ids = Module::query()->pluck('id');
        $this->modules()->syncWithPivotValues($ids, ['enabled' => true]);
    }
}
