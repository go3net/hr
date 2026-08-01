<?php

namespace Tests\Feature;

use App\Models\Module;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class ModuleToggleTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_disabled_module_routes_are_blocked(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $admin = $this->createUserWithRole($tenant, 'super_admin');

        // Projects is not core — disable it directly.
        $projects = Module::query()->where('key', 'projects')->firstOrFail();
        $tenant->modules()->syncWithoutDetaching([$projects->id => ['enabled' => false]]);

        $this->actingAsTenantUser($admin)
            ->getJson('/api/v1/hr/employees')
            ->assertOk(); // hr stays on

        $this->assertFalse($tenant->hasModuleEnabled('projects'));
        $this->assertTrue($tenant->hasModuleEnabled('hr'));
    }

    public function test_admin_can_toggle_a_module_but_not_core_modules(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $admin = $this->createUserWithRole($tenant, 'super_admin');

        $this->actingAsTenantUser($admin)
            ->patchJson('/api/v1/modules/projects', ['enabled' => false])
            ->assertOk()
            ->assertJsonPath('data.enabled', false);

        $this->actingAsTenantUser($admin)
            ->patchJson('/api/v1/modules/hr', ['enabled' => false])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'MODULE_IS_CORE');
    }

    public function test_disabled_module_middleware_returns_403(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $admin = $this->createUserWithRole($tenant, 'super_admin');

        $dashboard = Module::query()->where('key', 'dashboard')->firstOrFail();
        $tenant->modules()->syncWithoutDetaching([$dashboard->id => ['enabled' => false]]);

        $this->actingAsTenantUser($admin)
            ->getJson('/api/v1/dashboard/summary')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'MODULE_DISABLED');
    }
}
