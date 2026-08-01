<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class WorkspaceSettingsTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_branding_update_validation_and_logo_roundtrip(): void
    {
        Storage::fake();

        $this->seedCatalog();
        $tenant = $this->createTenant();
        $ceo = $this->createUserWithRole($tenant, 'ceo');
        $employee = $this->createUserWithRole($tenant, 'employee');

        // Bad hex rejected.
        $this->actingAsTenantUser($ceo)
            ->patchJson('/api/v1/settings/branding', ['primary_color' => 'blue'])
            ->assertUnprocessable();

        $branding = $this->actingAsTenantUser($ceo)
            ->patchJson('/api/v1/settings/branding', [
                'display_name' => 'Acme Workspace',
                'primary_color' => '#7C3AED',
                'accent_color' => '#F59E0B',
            ])
            ->assertOk()
            ->json('data');
        $this->assertSame('#7C3AED', $branding['primary_color']);
        $this->assertFalse($branding['has_logo']);

        // Branding lands in the bootstrap payload for theming.
        $boot = $this->actingAsTenantUser($employee)->getJson('/api/v1/me/bootstrap')->json('data');
        $this->assertSame('#7C3AED', $boot['tenant']['branding']['primary_color']);

        // Logo upload + streamed download.
        $upload = $this->actingAsTenantUser($ceo)
            ->post('/api/v1/settings/branding/logo', [
                'logo' => UploadedFile::fake()->image('logo.png', 300, 100),
            ])
            ->assertOk()
            ->json('data');
        $this->assertTrue($upload['has_logo']);

        $this->actingAsTenantUser($employee->fresh())
            ->get('/api/v1/settings/branding/logo')
            ->assertOk();

        // Employees can read branding but not change it.
        $this->actingAsTenantUser($employee)
            ->patchJson('/api/v1/settings/branding', ['display_name' => 'Hacked'])
            ->assertForbidden();
    }

    public function test_custom_role_lifecycle_and_permission_grant(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $ceo = $this->createUserWithRole($tenant, 'ceo');
        $member = $this->createUserWithRole($tenant, 'employee');

        // The member can't see CRM yet.
        $this->actingAsTenantUser($member)->getJson('/api/v1/crm/leads')->assertForbidden();

        $role = $this->actingAsTenantUser($ceo)
            ->postJson('/api/v1/settings/roles', [
                'name' => 'Sales Associate',
                'permissions' => ['crm.view', 'crm.manage'],
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('sales_associate', $role['key']);
        $this->assertFalse($role['is_system']);

        // Assign it alongside the employee role.
        $roles = collect($this->actingAsTenantUser($ceo)->getJson('/api/v1/settings/roles')->json('data'));
        $employeeRoleId = $roles->firstWhere('key', 'employee')['id'];
        $this->actingAsTenantUser($ceo)
            ->patchJson("/api/v1/settings/users/{$member->id}/roles", [
                'role_ids' => [$employeeRoleId, $role['id']],
            ])
            ->assertOk();

        // The grant is live.
        $this->actingAsTenantUser($member->fresh())->getJson('/api/v1/crm/leads')->assertOk();

        // Narrow the role: manage only view now.
        $this->actingAsTenantUser($ceo)
            ->patchJson("/api/v1/settings/roles/{$role['id']}", ['permissions' => ['crm.view']])
            ->assertOk()
            ->assertJsonPath('data.permissions', ['crm.view']);

        // System roles are immutable; foreign-tenant roles invisible.
        $systemRoleId = $roles->firstWhere('key', 'hr_manager')['id'];
        $this->actingAsTenantUser($ceo)
            ->patchJson("/api/v1/settings/roles/{$systemRoleId}", ['name' => 'Broken'])
            ->assertForbidden();
        $this->actingAsTenantUser($ceo)
            ->deleteJson("/api/v1/settings/roles/{$systemRoleId}")
            ->assertForbidden();

        // Deleting the custom role detaches it from the member.
        $this->actingAsTenantUser($ceo)
            ->deleteJson("/api/v1/settings/roles/{$role['id']}")
            ->assertNoContent();
        $this->actingAsTenantUser($member->fresh())->getJson('/api/v1/crm/leads')->assertForbidden();
    }

    public function test_role_management_permission_and_lockout_guard(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $admin = $this->createUserWithRole($tenant, 'super_admin');
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($employee)->getJson('/api/v1/settings/roles')->assertForbidden();

        // A super admin cannot strip their own super_admin role.
        $roles = collect($this->actingAsTenantUser($admin)->getJson('/api/v1/settings/roles')->json('data'));
        $employeeRoleId = $roles->firstWhere('key', 'employee')['id'];
        $this->actingAsTenantUser($admin)
            ->patchJson("/api/v1/settings/users/{$admin->id}/roles", ['role_ids' => [$employeeRoleId]])
            ->assertUnprocessable();
    }
}
