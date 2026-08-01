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

    protected $fillable = ['name', 'subdomain', 'custom_domain', 'branding', 'settings', 'status', 'plan_key', 'trial_ends_at', 'subscription_ends_at'];

    protected function casts(): array
    {
        return [
            'branding' => 'array',
            'settings' => 'array',
            'trial_ends_at' => 'datetime',
            'subscription_ends_at' => 'datetime',
        ];
    }

    /**
     * Where this workspace stands: 'active' (paid period running), 'trial'
     * (trial running, nothing paid yet), 'expired' (trial and/or paid period
     * over), or 'complimentary' (no dates at all — internal workspaces).
     */
    public function subscriptionState(): string
    {
        if ($this->subscription_ends_at?->isFuture()) {
            return 'active';
        }
        if ($this->trial_ends_at?->isFuture() && ! $this->subscription_ends_at) {
            return 'trial';
        }
        if ($this->trial_ends_at || $this->subscription_ends_at) {
            return 'expired';
        }

        return 'complimentary';
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
