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
}
