<?php

namespace Tests\Feature;

use App\Models\BillingPayment;
use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class PlatformConsoleTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_console_is_closed_to_everyone_without_the_flag(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();

        // Not even the top of a workspace gets in — super_admin is the top of
        // one tenant, the platform owner sits above all of them.
        $this->actingAsTenantUser($this->createUserWithRole($tenant, 'super_admin'))
            ->getJson('/api/v1/platform/summary')
            ->assertForbidden();

        $this->actingAsTenantUser($this->createUserWithRole($tenant, 'employee'))
            ->getJson('/api/v1/platform/workspaces')
            ->assertForbidden();
    }

    public function test_owner_sees_every_workspace_with_billing_and_headcount(): void
    {
        $this->seedCatalog();
        $home = $this->createTenant('go3net', 'Go3net');
        $customer = $this->createTenant('acme', 'Acme Ltd');
        $customer->update(['status' => 'trial', 'plan_key' => 'growth', 'trial_ends_at' => now()->addDays(3)]);

        $staff = $this->createUserWithRole($customer, 'hr_manager');
        Employee::withoutGlobalScopes()->create([
            'tenant_id' => $customer->id,
            'user_id' => $staff->id,
            'employee_code' => 'ACM-001',
            'first_name' => 'Ada',
            'last_name' => 'Obi',
            'email' => 'ada@acme.test',
            'hire_date' => now()->subYear(),
            'status' => 'active',
        ]);

        BillingPayment::withoutGlobalScopes()->create([
            'tenant_id' => $customer->id,
            'user_id' => $staff->id,
            'plan_key' => 'growth',
            'amount' => 50_000,
            'reference' => 'g3n_platform_test',
            'status' => 'paid',
            // Keep this in the current calendar month. Using "yesterday"
            // made the revenue assertion fail whenever CI ran on the first.
            'paid_at' => now(),
        ]);

        $owner = $this->createUserWithRole($home, 'super_admin', ['is_platform_owner' => true]);

        $summary = $this->actingAsTenantUser($owner)
            ->getJson('/api/v1/platform/summary')
            ->assertOk()
            ->json('data');

        $this->assertSame(2, $summary['workspaces']);
        $this->assertSame(1, $summary['trialing']);
        $this->assertSame(1, $summary['trials_ending_soon']);
        $this->assertEqualsWithDelta(50000, $summary['revenue_this_month'], 0.01);
        $this->assertSame(1, $summary['seats']);

        $rows = $this->actingAsTenantUser($owner)
            ->getJson('/api/v1/platform/workspaces')
            ->assertOk()
            ->json('data');

        $acme = collect($rows)->firstWhere('name', 'Acme Ltd');
        $this->assertNotNull($acme);
        $this->assertSame('growth', $acme['plan_key']);
        $this->assertSame(1, $acme['headcount']);
        $this->assertEqualsWithDelta(50000, $acme['paid_total'], 0.01);
    }

    public function test_owner_can_suspend_extend_and_change_plan(): void
    {
        $this->seedCatalog();
        $home = $this->createTenant('go3net', 'Go3net');
        $customer = $this->createTenant('acme', 'Acme Ltd');
        // An already-lapsed trial: extending it must give a full future window,
        // not add days to a date in the past.
        $customer->update(['status' => 'trial', 'trial_ends_at' => now()->subDays(10)]);

        $owner = $this->createUserWithRole($home, 'super_admin', ['is_platform_owner' => true]);

        $this->actingAsTenantUser($owner)
            ->patchJson("/api/v1/platform/workspaces/{$customer->public_id}", ['extend_trial_days' => 14])
            ->assertOk();

        $customer->refresh();
        $this->assertTrue($customer->trial_ends_at->gt(now()->addDays(13)));

        $this->actingAsTenantUser($owner)
            ->patchJson("/api/v1/platform/workspaces/{$customer->public_id}", [
                'status' => 'suspended',
                'plan_key' => 'enterprise',
            ])
            ->assertOk();

        $customer->refresh();
        $this->assertSame('suspended', $customer->status);
        $this->assertSame('enterprise', $customer->plan_key);
    }

    public function test_platform_owner_still_cannot_read_another_workspaces_hr_data(): void
    {
        $this->seedCatalog();
        $home = $this->createTenant('go3net', 'Go3net');
        $customer = $this->createTenant('acme', 'Acme Ltd');

        $staff = $this->createUserWithRole($customer, 'hr_manager');
        Employee::withoutGlobalScopes()->create([
            'tenant_id' => $customer->id,
            'user_id' => $staff->id,
            'employee_code' => 'ACM-001',
            'first_name' => 'Ada',
            'last_name' => 'Obi',
            'email' => 'ada@acme.test',
            'hire_date' => now()->subYear(),
            'status' => 'active',
            'base_salary' => 900_000,
        ]);

        $owner = $this->createUserWithRole($home, 'super_admin', ['is_platform_owner' => true]);

        // The flag buys account-level oversight, nothing more. Tenant isolation
        // is what keeps a customer's staff, salaries and documents private, and
        // the flag does not weaken it.
        $employees = $this->actingAsTenantUser($owner)
            ->getJson('/api/v1/hr/employees')
            ->assertOk()
            ->json('data');

        $this->assertEmpty($employees);

        // Nor does the console itself leak them — it reports a headcount, not
        // a staff list.
        $detail = $this->actingAsTenantUser($owner)
            ->getJson("/api/v1/platform/workspaces/{$customer->public_id}")
            ->assertOk()
            ->json('data');

        $this->assertSame(1, $detail['headcount']);
        $this->assertArrayNotHasKey('employees', $detail);
        $this->assertStringNotContainsString('Ada', json_encode($detail));
    }

    public function test_configured_owner_email_opens_the_console_without_a_database_change(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $founder = $this->createUserWithRole($tenant, 'super_admin', ['email' => 'founder@go3net.com']);

        // Closed before the address is listed…
        $this->actingAsTenantUser($founder)->getJson('/api/v1/platform/summary')->assertForbidden();

        // …and open after, with no column touched. This is the only way to
        // grant the first owner on a stack where nobody has a shell.
        config(['platform.owners' => ['founder@go3net.com']]);

        $this->actingAsTenantUser($founder)->getJson('/api/v1/platform/summary')->assertOk();
        $this->assertFalse((bool) $founder->fresh()->getAttributes()['is_platform_owner']);
    }

    public function test_bootstrap_tells_the_client_who_owns_the_platform(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();

        $this->actingAsTenantUser($this->createUserWithRole($tenant, 'super_admin'))
            ->getJson('/api/v1/me/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.is_platform_owner', false);

        $owner = $this->createUserWithRole($tenant, 'employee', ['is_platform_owner' => true]);

        $this->actingAsTenantUser($owner)
            ->getJson('/api/v1/me/bootstrap')
            ->assertOk()
            ->assertJsonPath('data.is_platform_owner', true);
    }
}
