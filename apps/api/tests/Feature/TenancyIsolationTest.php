<?php

namespace Tests\Feature;

use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class TenancyIsolationTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_a_tenant_cannot_see_another_tenants_employees(): void
    {
        $this->seedCatalog();

        $acme = $this->createTenant('acme');
        $globex = $this->createTenant('globex', 'Globex Corp');

        Employee::create([
            'tenant_id' => $acme->id,
            'employee_code' => 'ACM-1',
            'first_name' => 'Ada',
            'last_name' => 'Acme',
        ]);
        Employee::create([
            'tenant_id' => $globex->id,
            'employee_code' => 'GLX-1',
            'first_name' => 'Greg',
            'last_name' => 'Globex',
        ]);

        $acmeAdmin = $this->createUserWithRole($acme, 'super_admin');

        $response = $this->actingAsTenantUser($acmeAdmin)->getJson('/api/v1/hr/employees');

        $response->assertOk();
        $names = collect($response->json('data'))->pluck('name');
        $this->assertTrue($names->contains('Ada Acme'));
        $this->assertFalse($names->contains('Greg Globex'));
    }

    public function test_fetching_another_tenants_employee_by_id_is_a_404(): void
    {
        $this->seedCatalog();

        $acme = $this->createTenant('acme');
        $globex = $this->createTenant('globex', 'Globex Corp');

        $foreign = Employee::create([
            'tenant_id' => $globex->id,
            'employee_code' => 'GLX-1',
            'first_name' => 'Greg',
            'last_name' => 'Globex',
        ]);

        $acmeAdmin = $this->createUserWithRole($acme, 'super_admin');

        $this->actingAsTenantUser($acmeAdmin)
            ->getJson("/api/v1/hr/employees/{$foreign->public_id}")
            ->assertNotFound();
    }

    public function test_route_model_binding_is_tenant_scoped_without_preset_context(): void
    {
        // Regression: in production the tenant context is bound by
        // middleware, not before the request like actingAsTenantUser does.
        // Binding must still be scoped, so authenticate purely via token.
        $this->seedCatalog();

        $acme = $this->createTenant('acme');
        $globex = $this->createTenant('globex', 'Globex Corp');

        $foreign = Employee::create([
            'tenant_id' => $globex->id,
            'employee_code' => 'GLX-1',
            'first_name' => 'Greg',
            'last_name' => 'Globex',
        ]);

        $acmeAdmin = $this->createUserWithRole($acme, 'super_admin');
        $token = $acmeAdmin->createToken('test')->plainTextToken;

        app(\App\Core\Tenancy\TenantContext::class)->forget();

        $this->withToken($token)
            ->getJson("/api/v1/hr/employees/{$foreign->public_id}")
            ->assertNotFound();
    }

    public function test_employee_role_cannot_manage_employees(): void
    {
        $this->seedCatalog();

        $acme = $this->createTenant('acme');
        $employeeUser = $this->createUserWithRole($acme, 'employee');

        $this->actingAsTenantUser($employeeUser)
            ->postJson('/api/v1/hr/employees', [
                'employee_code' => 'X-1',
                'first_name' => 'No',
                'last_name' => 'Access',
            ])
            ->assertForbidden();
    }
}
