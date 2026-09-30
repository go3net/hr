<?php

namespace Tests\Feature;

use App\Core\Notifications\PasswordReset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use InteractsWithTenancy;
    use RefreshDatabase;

    public function test_reset_requests_do_not_disclose_whether_an_account_exists(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee', ['email' => 'person@example.test']);
        Notification::fake();

        $known = $this->withHeader('X-Tenant', $tenant->subdomain)
            ->postJson('/api/v1/auth/forgot-password', ['email' => $user->email]);
        $unknown = $this->withHeader('X-Tenant', $tenant->subdomain)
            ->postJson('/api/v1/auth/forgot-password', ['email' => 'missing@example.test']);

        $known->assertOk()->assertJsonPath('data.message', 'If an account matches that email address, a password-reset link has been sent.');
        $unknown->assertOk()->assertExactJson($known->json());
        Notification::assertSentTo($user, PasswordReset::class);
    }

    public function test_a_valid_reset_changes_the_password_revokes_api_tokens_and_cannot_be_reused(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee', [
            'email' => 'person@example.test',
            'password' => 'Original-pass-123',
        ]);
        $user->createToken('existing-session');
        Notification::fake();

        $this->withHeader('X-Tenant', $tenant->subdomain)
            ->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])
            ->assertOk();

        $token = null;
        Notification::assertSentTo($user, PasswordReset::class, function (PasswordReset $notification) use (&$token): bool {
            $token = $notification->token;

            return true;
        });

        $payload = [
            'email' => $user->email,
            'token' => $token,
            'password' => 'Replacement-pass-456',
            'password_confirmation' => 'Replacement-pass-456',
        ];

        $this->withHeader('X-Tenant', $tenant->subdomain)
            ->postJson('/api/v1/auth/reset-password', $payload)
            ->assertOk()
            ->assertJsonPath('data.message', 'Your password has been reset. You can now sign in.');

        $this->assertTrue(Hash::check('Replacement-pass-456', $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->withHeader('X-Tenant', $tenant->subdomain)
            ->postJson('/api/v1/auth/reset-password', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('token');
    }

    public function test_an_admin_can_start_a_reset_for_a_locked_out_employee(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $staff = $this->createUserWithRole($tenant, 'employee', ['email' => 'locked.out@example.test']);

        $employee = \App\Models\Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $staff->id,
            'employee_code' => 'E-77',
            'first_name' => 'Locked',
            'last_name' => 'Out',
            'email' => $staff->email,
            'hire_date' => now()->subYear(),
            'status' => 'active',
        ]);

        Notification::fake();

        $body = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/password-reset")
            ->assertOk()
            ->json('data');

        $this->assertSame($staff->email, $body['email']);
        Notification::assertSentTo($staff, PasswordReset::class);

        // The admin never sets the password — they pass on a link the employee
        // uses to choose their own, so the returned URL has to actually work.
        parse_str(parse_url($body['reset_url'], PHP_URL_QUERY) ?? '', $query);
        $this->assertSame($staff->email, $query['email']);

        $this->withHeader('X-Tenant', $tenant->subdomain)
            ->postJson('/api/v1/auth/reset-password', [
                'email' => $staff->email,
                'token' => $query['token'],
                'password' => 'brand-new-pass-99',
                'password_confirmation' => 'brand-new-pass-99',
            ])
            ->assertOk();

        $this->assertTrue(Hash::check('brand-new-pass-99', $staff->fresh()->password));
    }

    public function test_starting_a_reset_needs_the_permission_and_a_usable_account(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $nosy = $this->createUserWithRole($tenant, 'employee');

        // Someone with no account yet should be invited, not reset.
        $noAccount = \App\Models\Employee::create([
            'tenant_id' => $tenant->id,
            'employee_code' => 'E-78',
            'first_name' => 'Not',
            'last_name' => 'Invited',
            'hire_date' => now(),
            'status' => 'active',
        ]);

        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$noAccount->public_id}/password-reset")
            ->assertStatus(422);

        // And staff cannot start one for a colleague.
        $colleague = \App\Models\Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $hr->id,
            'employee_code' => 'E-79',
            'first_name' => 'Hr',
            'last_name' => 'Person',
            'email' => $hr->email,
            'hire_date' => now(),
            'status' => 'active',
        ]);

        $this->actingAsTenantUser($nosy)
            ->postJson("/api/v1/hr/employees/{$colleague->public_id}/password-reset")
            ->assertForbidden();
    }
}
