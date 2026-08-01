<?php

namespace Tests\Concerns;

use App\Core\Tenancy\TenantContext;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\RolePermissionSeeder;

trait InteractsWithTenancy
{
    protected function seedCatalog(): void
    {
        $this->seed(ModuleSeeder::class);
        $this->seed(RolePermissionSeeder::class);
    }

    protected function createTenant(string $subdomain = 'acme', string $name = 'Acme Ltd'): Tenant
    {
        $tenant = Tenant::create(['name' => $name, 'subdomain' => $subdomain, 'status' => 'active']);
        $tenant->enableAllModules();

        return $tenant;
    }

    protected function createUserWithRole(Tenant $tenant, string $roleKey, array $attributes = []): User
    {
        $user = User::create(array_merge([
            'tenant_id' => $tenant->id,
            'name' => ucfirst($roleKey).' User',
            'email' => $roleKey.'-'.uniqid().'@example.com',
            'password' => 'secret-password-123',
        ], $attributes));

        $role = Role::query()->whereNull('tenant_id')->where('key', $roleKey)->firstOrFail();
        $user->roles()->attach($role->id);

        return $user;
    }

    protected function actingAsTenantUser(User $user): static
    {
        app(TenantContext::class)->set($user->tenant);

        return $this->actingAs($user, 'sanctum');
    }
}
