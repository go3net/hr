<?php

namespace App\Core\Tenancy;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Global scope that constrains every query on tenant-owned models to the
 * current tenant. With no tenant in context (system commands, tests that
 * opt out), queries are left untouched — request middleware guarantees a
 * tenant is always bound before any tenant-owned model is queried.
 */
class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $context = app(TenantContext::class);

        if ($context->check()) {
            $builder->where($model->qualifyColumn('tenant_id'), $context->id());
        }
    }
}
