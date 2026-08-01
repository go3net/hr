<?php

namespace Tests\Feature;

use App\Core\Notifications\TicketSubmitted;
use App\Models\DeviceToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class PushNotificationTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function configureFakeFirebase(): void
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $pem);

        config(['services.fcm.credentials' => json_encode([
            'project_id' => 'go3net-test',
            'client_email' => 'fcm@go3net-test.iam.gserviceaccount.com',
            'private_key' => $pem,
        ])]);
    }

    public function test_device_token_registration_is_idempotent_and_scoped(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/me/device-tokens', ['token' => 'tok-abc', 'platform' => 'android'])
            ->assertCreated();
        // Re-registering the same token updates instead of duplicating.
        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/me/device-tokens', ['token' => 'tok-abc', 'platform' => 'android'])
            ->assertCreated();
        $this->assertSame(1, DeviceToken::withoutGlobalScopes()->count());

        $this->actingAsTenantUser($user)
            ->deleteJson('/api/v1/me/device-tokens', ['token' => 'tok-abc'])
            ->assertOk();
        $this->assertSame(0, DeviceToken::withoutGlobalScopes()->count());
    }

    public function test_notification_pushes_to_devices_and_prunes_dead_tokens(): void
    {
        $this->configureFakeFirebase();
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $agent = $this->createUserWithRole($tenant, 'hr_manager');

        DeviceToken::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id, 'user_id' => $agent->id, 'token' => 'tok-live', 'platform' => 'android',
        ]);
        DeviceToken::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id, 'user_id' => $agent->id, 'token' => 'tok-dead', 'platform' => 'web',
        ]);

        Http::fake([
            'oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.fake', 'expires_in' => 3600]),
            'fcm.googleapis.com/*' => fn ($request) => $request['message']['token'] === 'tok-dead'
                ? Http::response(['error' => ['status' => 'UNREGISTERED']], 404)
                : Http::response(['name' => 'projects/go3net-test/messages/1']),
        ]);

        // Synchronous send (queue runs inline in tests).
        $agent->notify(new TicketSubmitted('HD-0009', 'Printer jam', 'Someone'));

        // The live token was used; the dead one was pruned.
        $this->assertSame(1, DeviceToken::withoutGlobalScopes()->count());
        $remaining = DeviceToken::withoutGlobalScopes()->sole();
        $this->assertSame('tok-live', $remaining->token);
        $this->assertNotNull($remaining->last_seen_at);

        // The FCM payload carried the notification content.
        Http::assertSent(fn ($request) => str_contains($request->url(), 'messages:send')
            && $request['message']['notification']['title'] === 'New ticket HD-0009'
            && $request['message']['data']['url'] === '/helpdesk');

        // The OAuth exchange used a signed JWT bearer grant.
        Http::assertSent(fn ($request) => str_contains($request->url(), 'oauth2.googleapis.com')
            && $request['grant_type'] === 'urn:ietf:params:oauth:grant-type:jwt-bearer'
            && substr_count($request['assertion'], '.') === 2);
    }

    public function test_no_push_channel_when_unconfigured_or_no_devices(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        Http::fake();

        // Unconfigured: notification still lands in the database, nothing HTTP.
        $user->notify(new TicketSubmitted('HD-0010', 'Test', 'Someone'));
        $this->assertSame(1, $user->notifications()->count());
        Http::assertNothingSent();

        // Configured but the user has no devices → still nothing HTTP.
        $this->configureFakeFirebase();
        $user->notify(new TicketSubmitted('HD-0011', 'Test 2', 'Someone'));
        Http::assertNothingSent();
    }
}
