<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class OAuthTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function fakeProvider(string $email, string $id = 'ext-123'): void
    {
        $oauthUser = Mockery::mock(SocialiteUser::class);
        $oauthUser->shouldReceive('getEmail')->andReturn($email);
        $oauthUser->shouldReceive('getId')->andReturn($id);

        $driver = Mockery::mock();
        $driver->shouldReceive('stateless')->andReturnSelf();
        $driver->shouldReceive('user')->andReturn($oauthUser);

        Socialite::shouldReceive('driver')->with('github')->andReturn($driver);
    }

    public function test_known_email_gets_a_one_time_code_then_a_token(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        $this->fakeProvider($user->email);

        $redirect = $this->get('/api/v1/auth/oauth/github/callback');
        $redirect->assertRedirect();

        $location = $redirect->headers->get('Location');
        $this->assertStringContainsString('oauth_code=', $location);
        parse_str(parse_url($location, PHP_URL_QUERY), $query);

        $this->postJson('/api/v1/auth/oauth/exchange', ['code' => $query['oauth_code']])
            ->assertOk()
            ->assertJsonStructure(['data' => ['token']]);

        // One-time: the code is burned.
        $this->postJson('/api/v1/auth/oauth/exchange', ['code' => $query['oauth_code']])
            ->assertUnprocessable();

        $this->assertSame('github', $user->fresh()->provider);
    }

    public function test_unknown_email_is_bounced_without_an_account(): void
    {
        $this->seedCatalog();
        $this->fakeProvider('stranger@nowhere.test');

        $this->get('/api/v1/auth/oauth/github/callback')
            ->assertRedirect()
            ->assertRedirectContains('oauth_error=no_account');
    }

    public function test_unknown_provider_is_a_404(): void
    {
        $this->getJson('/api/v1/auth/oauth/facebook/redirect')->assertNotFound();
    }
}
