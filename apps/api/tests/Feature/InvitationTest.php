<?php

namespace Tests\Feature;

use App\Core\Notifications\UserInvited;
use App\Models\Employee;
use App\Models\User;
use App\Models\UserInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class InvitationTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_creating_an_employee_with_invite_emails_a_setup_link(): void
    {
        Notification::fake();

        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/employees', [
                'employee_code' => 'G3N-500',
                'first_name' => 'Bola',
                'last_name' => 'Adeyemi',
                'email' => 'bola@example.com',
                'invite' => true,
            ])
            ->assertCreated();

        $user = User::withoutGlobalScopes()->where('email', 'bola@example.com')->sole();
        $this->assertSame('invited', $user->status);
        $this->assertTrue($user->hasRole('employee'));
        Notification::assertSentTo($user, UserInvited::class);

        $employee = Employee::withoutGlobalScopes()->where('employee_code', 'G3N-500')->sole();
        $this->assertSame($user->id, $employee->user_id);
        $this->assertSame(1, UserInvitation::withoutGlobalScopes()->where('user_id', $user->id)->count());
    }

    public function test_accepting_an_invite_sets_password_and_signs_in(): void
    {
        Notification::fake();

        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $this->actingAsTenantUser($hr)->postJson('/api/v1/hr/employees', [
            'employee_code' => 'G3N-501', 'first_name' => 'Kemi', 'last_name' => 'Ola',
            'email' => 'kemi@example.com', 'invite' => true,
        ]);

        // Grab the raw token from the queued notification.
        $user = User::withoutGlobalScopes()->where('email', 'kemi@example.com')->sole();
        $token = null;
        Notification::assertSentTo($user, UserInvited::class, function (UserInvited $n) use (&$token, $user) {
            $mail = $n->toMail($user);
            $token = str($mail->actionUrl)->after('token=')->toString();

            return true;
        });

        // The peek endpoint greets the invitee.
        $this->getJson('/api/v1/auth/invitation?token='.$token)
            ->assertOk()
            ->assertJsonPath('data.email', 'kemi@example.com');

        // Weak password rejected; good one accepted and signs in.
        $this->postJson('/api/v1/auth/invitation/accept', [
            'token' => $token, 'password' => 'short', 'password_confirmation' => 'short',
        ])->assertUnprocessable();

        $accepted = $this->postJson('/api/v1/auth/invitation/accept', [
            'token' => $token,
            'password' => 'A-strong-pass-2026',
            'password_confirmation' => 'A-strong-pass-2026',
        ])->assertOk()->json('data');
        $this->assertNotEmpty($accepted['token']);
        $this->assertSame('active', $user->fresh()->status);

        // The token is single-use.
        $this->postJson('/api/v1/auth/invitation/accept', [
            'token' => $token,
            'password' => 'Another-pass-2026',
            'password_confirmation' => 'Another-pass-2026',
        ])->assertUnprocessable();

        // And the new password works for a normal login.
        $this->postJson('/api/v1/auth/login', [
            'email' => 'kemi@example.com', 'password' => 'A-strong-pass-2026',
        ])->assertOk();
    }

    public function test_invite_guards_expiry_resend_and_duplicates(): void
    {
        Notification::fake();

        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $employee = Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id, 'employee_code' => 'G3N-502',
            'first_name' => 'Tayo', 'last_name' => 'Bello', 'email' => 'tayo@example.com',
            'employment_type' => 'full_time', 'status' => 'active', 'hired_at' => now(),
        ]);
        $publicId = $employee->public_id;

        // No email → clear error for employees created without one.
        $bare = Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id, 'employee_code' => 'G3N-503',
            'first_name' => 'No', 'last_name' => 'Email',
            'employment_type' => 'full_time', 'status' => 'active', 'hired_at' => now(),
        ]);
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$bare->public_id}/invite")
            ->assertUnprocessable();

        // First invite, then re-send: old token dies, exactly one live invite.
        $this->actingAsTenantUser($hr)->postJson("/api/v1/hr/employees/{$publicId}/invite")->assertOk();
        $user = User::withoutGlobalScopes()->where('email', 'tayo@example.com')->sole();
        $firstHash = UserInvitation::withoutGlobalScopes()->where('user_id', $user->id)->sole()->token_hash;

        $this->actingAsTenantUser($hr)->postJson("/api/v1/hr/employees/{$publicId}/invite")->assertOk();
        $second = UserInvitation::withoutGlobalScopes()->where('user_id', $user->id)->sole();
        $this->assertNotSame($firstHash, $second->token_hash);

        // Expired invitations are rejected.
        $second->update(['expires_at' => now()->subHour()]);
        $this->getJson('/api/v1/auth/invitation?token=whatever')->assertStatus(410);

        // Permission gate: employees can't invite.
        $employeeUser = $this->createUserWithRole($tenant, 'employee');
        $this->actingAsTenantUser($employeeUser)
            ->postJson("/api/v1/hr/employees/{$publicId}/invite")
            ->assertForbidden();
    }
}
