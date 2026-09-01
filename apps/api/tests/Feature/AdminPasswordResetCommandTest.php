<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class AdminPasswordResetCommandTest extends TestCase
{
    use InteractsWithTenancy;
    use RefreshDatabase;

    public function test_it_resets_an_admin_password_interactively_and_revokes_tokens(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $admin = $this->createUserWithRole($tenant, 'super_admin', ['email' => 'admin@example.test']);
        $admin->createToken('existing-session');

        $this->artisan('admin:reset-password', ['email' => $admin->email])
            ->expectsQuestion('New password', 'New-admin-pass-456')
            ->expectsQuestion('Confirm password', 'New-admin-pass-456')
            ->expectsOutput("Password reset for {$admin->email}. Existing API sessions were revoked.")
            ->assertExitCode(0);

        $this->assertTrue(Hash::check('New-admin-pass-456', $admin->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('audit_logs', ['action' => 'auth.admin_password_reset', 'user_id' => null]);
    }

    public function test_it_rejects_non_admin_accounts(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee', ['email' => 'staff@example.test']);

        $this->artisan('admin:reset-password', ['email' => $user->email])
            ->expectsOutput('This command is restricted to workspace administrators and platform owners.')
            ->assertExitCode(1);
    }
}
