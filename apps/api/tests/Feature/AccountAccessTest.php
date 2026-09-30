<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class AccountAccessTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_an_admin_can_set_a_password_and_the_person_can_sign_in_with_it(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $staff = $this->createUserWithRole($tenant, 'employee', ['email' => 'floor.staff@example.test']);

        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/settings/access/{$staff->id}/password", [
                'password' => 'handed-over-2026',
                'password_confirmation' => 'handed-over-2026',
            ])
            ->assertOk();

        $this->assertTrue(Hash::check('handed-over-2026', $staff->fresh()->password));

        // The password is the whole point, so it has to actually sign in.
        $this->withHeader('X-Tenant', $tenant->subdomain)
            ->postJson('/api/v1/auth/login', [
                'email' => 'floor.staff@example.test',
                'password' => 'handed-over-2026',
            ])
            ->assertOk();
    }

    public function test_setting_a_password_ends_the_sessions_that_account_already_had(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $staff = $this->createUserWithRole($tenant, 'employee');

        $staff->createToken('phone');
        $this->assertSame(1, $staff->tokens()->count());

        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/settings/access/{$staff->id}/password", [
                'password' => 'handed-over-2026',
                'password_confirmation' => 'handed-over-2026',
            ])
            ->assertOk();

        // Whoever was signed in on the old password — including whoever locked
        // them out — stops being signed in.
        $this->assertSame(0, $staff->fresh()->tokens()->count());
    }

    public function test_an_invited_account_becomes_usable_when_a_password_is_set(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $pending = $this->createUserWithRole($tenant, 'employee', ['status' => 'invited']);

        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/settings/access/{$pending->id}/password", [
                'password' => 'handed-over-2026',
                'password_confirmation' => 'handed-over-2026',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'active');
    }

    public function test_managing_employees_is_not_a_route_into_an_administrator_account(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $owner = $this->createUserWithRole($tenant, 'super_admin');

        // HR can manage employees. Resetting the owner would let them sign in
        // as the owner, which is a larger privilege than managing employees —
        // so both routes into that account are closed.
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/settings/access/{$owner->id}/password", [
                'password' => 'takeover-attempt-1',
                'password_confirmation' => 'takeover-attempt-1',
            ])
            ->assertForbidden();

        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/settings/access/{$owner->id}/reset-link")
            ->assertForbidden();

        $this->assertFalse(Hash::check('takeover-attempt-1', $owner->fresh()->password));

        // The owner may of course reset HR.
        $this->actingAsTenantUser($owner)
            ->postJson("/api/v1/settings/access/{$hr->id}/reset-link")
            ->assertOk();
    }

    public function test_the_list_says_which_accounts_each_administrator_may_reach(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $owner = $this->createUserWithRole($tenant, 'super_admin');
        $staff = $this->createUserWithRole($tenant, 'employee');

        $rows = collect($this->actingAsTenantUser($hr)
            ->getJson('/api/v1/settings/access')
            ->assertOk()
            ->json('data'))
            ->keyBy('id');

        // Buttons are shown against rows that will work, not rows that refuse.
        $this->assertFalse($rows[$owner->id]['can_manage'], 'HR must not be offered the owner');
        $this->assertTrue($rows[$staff->id]['can_manage']);
        $this->assertFalse($rows[$hr->id]['can_manage'], 'nobody resets themselves here');
        $this->assertTrue($rows[$hr->id]['is_self']);
    }

    public function test_staff_cannot_open_the_page_at_all(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $nosy = $this->createUserWithRole($tenant, 'employee');
        $other = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($nosy)->getJson('/api/v1/settings/access')->assertForbidden();

        $this->actingAsTenantUser($nosy)
            ->postJson("/api/v1/settings/access/{$other->id}/password", [
                'password' => 'not-allowed-2026',
                'password_confirmation' => 'not-allowed-2026',
            ])
            ->assertForbidden();
    }

    public function test_an_account_in_another_workspace_is_not_reachable(): void
    {
        $this->seedCatalog();
        $mine = $this->createTenant('acme', 'Acme');
        $theirs = $this->createTenant('rival', 'Rival Ltd');

        $hr = $this->createUserWithRole($mine, 'hr_manager');
        $stranger = $this->createUserWithRole($theirs, 'employee');

        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/settings/access/{$stranger->id}/password", [
                'password' => 'cross-tenant-2026',
                'password_confirmation' => 'cross-tenant-2026',
            ])
            ->assertNotFound();

        $this->assertFalse(Hash::check('cross-tenant-2026', User::withoutGlobalScopes()->find($stranger->id)->password));
    }
}
