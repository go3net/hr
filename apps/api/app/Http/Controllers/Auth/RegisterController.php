<?php

namespace App\Http\Controllers\Auth;

use App\Core\Http\ApiController;
use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password;

class RegisterController extends ApiController
{
    /** Create a new tenant workspace with its first (super admin) user. */
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company' => ['required', 'string', 'max:120'],
            'subdomain' => ['required', 'string', 'max:40', 'alpha_dash:ascii', 'unique:tenants,subdomain'],
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', Password::min(10)->letters()->numbers()],
        ]);

        [$tenant, $user] = DB::transaction(function () use ($data) {
            $tenant = Tenant::create([
                'name' => $data['company'],
                'subdomain' => strtolower($data['subdomain']),
                'status' => 'trial',
                'trial_ends_at' => now()->addDays(14),
            ]);

            $tenant->enableAllModules();

            $user = User::create([
                'tenant_id' => $tenant->id,
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
            ]);

            $superAdmin = Role::query()->whereNull('tenant_id')->where('key', 'super_admin')->first();
            if ($superAdmin) {
                $user->roles()->attach($superAdmin->id);
            }

            return [$tenant, $user];
        });

        app(TenantContext::class)->set($tenant);
        AuditLog::record('tenant.registered', $tenant);

        return $this->respond([
            'tenant' => [
                'name' => $tenant->name,
                'subdomain' => $tenant->subdomain,
                'status' => $tenant->status,
                'trial_ends_at' => $tenant->trial_ends_at,
            ],
            'token' => $user->createToken('signup')->plainTextToken,
        ], 201);
    }
}
