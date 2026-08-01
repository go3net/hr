<?php

namespace Tests\Feature;

use App\Models\Tenant;
use Database\Seeders\ModuleSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_company_can_register_a_workspace(): void
    {
        $this->seed(ModuleSeeder::class);
        $this->seed(RolePermissionSeeder::class);

        $response = $this->postJson('/api/v1/auth/register', [
            'company' => 'Acme Ltd',
            'subdomain' => 'acme',
            'name' => 'Jane Admin',
            'email' => 'jane@acme.test',
            'password' => 'sup3r-secret-pw',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tenant.subdomain', 'acme')
            ->assertJsonStructure(['data' => ['token']]);

        $tenant = Tenant::query()->where('subdomain', 'acme')->firstOrFail();
        $this->assertSame('trial', $tenant->status);
        $this->assertTrue($tenant->hasModuleEnabled('hr'));
        $this->assertTrue($tenant->users()->where('email', 'jane@acme.test')->exists());
    }

    public function test_subdomains_are_unique(): void
    {
        $this->seed(ModuleSeeder::class);
        $this->seed(RolePermissionSeeder::class);

        Tenant::create(['name' => 'First', 'subdomain' => 'acme', 'status' => 'active']);

        $this->postJson('/api/v1/auth/register', [
            'company' => 'Second',
            'subdomain' => 'acme',
            'name' => 'Jane',
            'email' => 'jane2@acme.test',
            'password' => 'sup3r-secret-pw',
        ])->assertUnprocessable()->assertJsonValidationErrors('subdomain');
    }

    public function test_login_returns_a_token(): void
    {
        $this->seed(ModuleSeeder::class);
        $this->seed(RolePermissionSeeder::class);

        $this->postJson('/api/v1/auth/register', [
            'company' => 'Acme Ltd',
            'subdomain' => 'acme',
            'name' => 'Jane Admin',
            'email' => 'jane@acme.test',
            'password' => 'sup3r-secret-pw',
        ])->assertCreated();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'jane@acme.test',
            'password' => 'sup3r-secret-pw',
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'jane@acme.test',
            'password' => 'wrong-password',
        ])->assertUnprocessable();
    }
}
