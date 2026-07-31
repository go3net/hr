<?php

namespace App\Core\Tenancy;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Apply to every tenant-owned model: adds the global tenant scope and
 * auto-fills tenant_id from the current context on create.
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope());

        static::creating(function ($model) {
            if (! $model->tenant_id && app(TenantContext::class)->check()) {
                $model->tenant_id = app(TenantContext::class)->id();
            }
        });
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
