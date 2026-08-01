<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PragmaRX\Google2FA\Google2FA;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class TwoFactorTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function enrolledUser(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee', ['password' => 'sup3r-secret-pw']);

        $secret = $this->actingAsTenantUser($user)
            ->postJson('/api/v1/me/two-factor/enable')
            ->assertOk()
            ->json('data.secret');

        $code = app(Google2FA::class)->getCurrentOtp($secret);

        $recovery = $this->actingAsTenantUser($user)
            ->postJson('/api/v1/me/two-factor/confirm', ['code' => $code])
            ->assertOk()
            ->json('data.recovery_codes');

        return [$user, $secret, $recovery];
    }

    public function test_enrollment_requires_a_valid_code(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($user)->postJson('/api/v1/me/two-factor/enable')->assertOk();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/me/two-factor/confirm', ['code' => '000000'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('code');
    }

    public function test_login_with_2fa_requires_a_challenge(): void
    {
        [$user, $secret] = $this->enrolledUser();

        // Password alone yields a challenge, never a token.
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'sup3r-secret-pw',
        ])->assertOk()->json('data');

        $this->assertTrue($login['two_factor_required']);
        $this->assertArrayNotHasKey('token', $login);

        // Wrong code fails; the challenge survives for a retry.
        $this->postJson('/api/v1/auth/two-factor', [
            'challenge_token' => $login['challenge_token'],
            'code' => '000000',
        ])->assertUnprocessable();

        // Correct TOTP completes the login.
        $this->postJson('/api/v1/auth/two-factor', [
            'challenge_token' => $login['challenge_token'],
            'code' => app(Google2FA::class)->getCurrentOtp($secret),
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);
    }

    public function test_recovery_codes_work_exactly_once(): void
    {
        [$user, , $recovery] = $this->enrolledUser();

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'sup3r-secret-pw',
        ])->json('data');

        $this->postJson('/api/v1/auth/two-factor', [
            'challenge_token' => $login['challenge_token'],
            'code' => $recovery[0],
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);

        // The same recovery code is burned.
        $login2 = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'sup3r-secret-pw',
        ])->json('data');

        $this->postJson('/api/v1/auth/two-factor', [
            'challenge_token' => $login2['challenge_token'],
            'code' => $recovery[0],
        ])->assertUnprocessable();
    }

    public function test_disable_requires_password_and_restores_plain_login(): void
    {
        [$user] = $this->enrolledUser();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/me/two-factor/disable', ['password' => 'wrong'])
            ->assertUnprocessable();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/me/two-factor/disable', ['password' => 'sup3r-secret-pw'])
            ->assertOk();

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'sup3r-secret-pw',
        ])->assertOk()->assertJsonStructure(['data' => ['token']]);
    }
}
