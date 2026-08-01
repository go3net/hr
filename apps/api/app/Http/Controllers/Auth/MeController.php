<?php

namespace App\Http\Controllers\Auth;

use App\Core\Http\ApiController;
use App\Core\Tenancy\TenantContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends ApiController
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('employee.department', 'employee.position', 'roles:id,key,name');

        return $this->respond([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->roles->map->only(['key', 'name']),
            'employee' => $user->employee,
        ]);
    }

    /** Everything the client shell needs on first paint. */
    public function bootstrap(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenant = app(TenantContext::class)->get();

        return $this->respond([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'tenant' => $tenant?->only(['id', 'name', 'subdomain', 'status', 'branding']),
            'modules' => $tenant?->modules()
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($m) => [
                    'key' => $m->key,
                    'name' => $m->name,
                    'enabled' => (bool) $m->pivot->enabled,
                ]),
            'subscription' => $tenant ? [
                'state' => $tenant->subscriptionState(),
                'plan_key' => $tenant->plan_key,
                'plan_name' => config("billing.plans.{$tenant->plan_key}.name"),
                'trial_ends_at' => $tenant->trial_ends_at?->toIso8601String(),
                'subscription_ends_at' => $tenant->subscription_ends_at?->toIso8601String(),
            ] : null,
            'permissions' => $user->hasRole('super_admin') ? ['*'] : $user->permissionKeys(),
            'unread_notifications' => $user->unreadNotifications()->count(),
        ]);
    }
}
