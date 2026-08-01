<?php

namespace Tests\Feature;

use App\Models\BillingPayment;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['billing.paystack.secret_key' => 'sk_test_secret']);
    }

    private function paystackUrl(string $path): string
    {
        return rtrim((string) config('billing.paystack.base_url'), '/').$path;
    }

    private function sign(array $payload): array
    {
        $body = json_encode($payload);

        return [$body, hash_hmac('sha512', $body, 'sk_test_secret')];
    }

    public function test_checkout_creates_pending_payment_and_returns_paystack_url(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $ceo = $this->createUserWithRole($tenant, 'ceo');

        Http::fake([
            $this->paystackUrl('/transaction/initialize') => Http::response([
                'status' => true,
                'data' => [
                    'authorization_url' => 'https://checkout.paystack.com/abc123',
                    'access_code' => 'abc123',
                    'reference' => 'ignored-by-us',
                ],
            ]),
        ]);

        $data = $this->actingAsTenantUser($ceo)
            ->postJson('/api/v1/billing/checkout', ['plan' => 'growth'])
            ->assertCreated()
            ->json('data');

        $this->assertSame('https://checkout.paystack.com/abc123', $data['authorization_url']);

        $payment = BillingPayment::withoutGlobalScopes()->where('reference', $data['reference'])->sole();
        $this->assertSame('pending', $payment->status);
        $this->assertEquals(60_000, $payment->amount);

        // Paystack was asked to charge the plan price in kobo.
        Http::assertSent(fn ($request) => str_contains($request->url(), '/transaction/initialize')
            && $request['amount'] === 6_000_000
            && $request['currency'] === 'NGN');
    }

    public function test_webhook_activates_subscription_and_is_idempotent(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $ceo = $this->createUserWithRole($tenant, 'ceo');

        $payment = BillingPayment::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $ceo->id,
            'plan_key' => 'starter',
            'amount' => 25_000,
            'reference' => 'g3n_webhook_test',
        ]);

        [$body, $signature] = $this->sign([
            'event' => 'charge.success',
            'data' => ['reference' => 'g3n_webhook_test', 'status' => 'success', 'amount' => 2_500_000, 'channel' => 'card'],
        ]);

        $this->call('POST', '/api/v1/billing/webhook/paystack', [], [], [], [
            'HTTP_X_PAYSTACK_SIGNATURE' => $signature,
            'CONTENT_TYPE' => 'application/json',
        ], $body)->assertOk();

        $tenant->refresh();
        $this->assertSame('active', $tenant->status);
        $this->assertSame('starter', $tenant->plan_key);
        $this->assertTrue($tenant->subscription_ends_at->isFuture());
        $this->assertSame('paid', $payment->fresh()->status);
        $firstEnd = $tenant->subscription_ends_at;

        // Replay: same event must not extend the period again.
        $this->call('POST', '/api/v1/billing/webhook/paystack', [], [], [], [
            'HTTP_X_PAYSTACK_SIGNATURE' => $signature,
            'CONTENT_TYPE' => 'application/json',
        ], $body)->assertOk();

        $this->assertEquals($firstEnd, $tenant->fresh()->subscription_ends_at);
    }

    public function test_renewal_extends_from_current_period_end(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $tenant->update(['subscription_ends_at' => now()->addDays(10), 'plan_key' => 'starter', 'status' => 'active']);
        $ceo = $this->createUserWithRole($tenant, 'ceo');

        BillingPayment::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $ceo->id,
            'plan_key' => 'starter',
            'amount' => 25_000,
            'reference' => 'g3n_renewal',
        ]);

        [$body, $signature] = $this->sign([
            'event' => 'charge.success',
            'data' => ['reference' => 'g3n_renewal', 'status' => 'success', 'amount' => 2_500_000, 'channel' => 'card'],
        ]);

        $this->call('POST', '/api/v1/billing/webhook/paystack', [], [], [], [
            'HTTP_X_PAYSTACK_SIGNATURE' => $signature,
            'CONTENT_TYPE' => 'application/json',
        ], $body)->assertOk();

        // 10 days remaining + 1 month, not now + 1 month.
        $this->assertTrue($tenant->fresh()->subscription_ends_at->gt(now()->addMonth()->addDays(9)));
    }

    public function test_webhook_rejects_invalid_signature_and_underpayment(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();

        [$body] = $this->sign(['event' => 'charge.success', 'data' => ['reference' => 'x']]);
        $this->call('POST', '/api/v1/billing/webhook/paystack', [], [], [], [
            'HTTP_X_PAYSTACK_SIGNATURE' => 'wrong',
            'CONTENT_TYPE' => 'application/json',
        ], $body)->assertUnauthorized();

        // Underpaid charge marks the payment failed and leaves the tenant alone.
        BillingPayment::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'plan_key' => 'scale',
            'amount' => 150_000,
            'reference' => 'g3n_underpaid',
        ]);

        [$body2, $sig2] = $this->sign([
            'event' => 'charge.success',
            'data' => ['reference' => 'g3n_underpaid', 'status' => 'success', 'amount' => 500_000],
        ]);
        $this->call('POST', '/api/v1/billing/webhook/paystack', [], [], [], [
            'HTTP_X_PAYSTACK_SIGNATURE' => $sig2,
            'CONTENT_TYPE' => 'application/json',
        ], $body2)->assertOk();

        $this->assertSame('failed', BillingPayment::withoutGlobalScopes()->where('reference', 'g3n_underpaid')->sole()->status);
        $this->assertNull($tenant->fresh()->plan_key);
    }

    public function test_expired_trial_locks_workspace_but_leaves_billing_reachable(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $tenant->update(['status' => 'trial', 'trial_ends_at' => now()->subDay()]);
        $ceo = $this->createUserWithRole($tenant, 'ceo');

        $this->actingAsTenantUser($ceo)
            ->getJson('/api/v1/hr/employees')
            ->assertStatus(402)
            ->assertJsonPath('error.code', 'SUBSCRIPTION_EXPIRED');

        $this->actingAsTenantUser($ceo)->getJson('/api/v1/me/bootstrap')->assertOk();

        $billing = $this->actingAsTenantUser($ceo)->getJson('/api/v1/billing')->assertOk()->json('data');
        $this->assertSame('expired', $billing['state']);
        $this->assertCount(3, $billing['plans']);
    }

    public function test_verify_endpoint_activates_after_callback(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $ceo = $this->createUserWithRole($tenant, 'ceo');

        BillingPayment::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $ceo->id,
            'plan_key' => 'growth',
            'amount' => 60_000,
            'reference' => 'g3n_callback',
        ]);

        Http::fake([
            $this->paystackUrl('/transaction/verify/g3n_callback') => Http::response([
                'status' => true,
                'data' => ['reference' => 'g3n_callback', 'status' => 'success', 'amount' => 6_000_000, 'channel' => 'bank'],
            ]),
        ]);

        $this->actingAsTenantUser($ceo)
            ->postJson('/api/v1/billing/verify', ['reference' => 'g3n_callback'])
            ->assertOk()
            ->assertJsonPath('data.activated', true);

        $this->assertSame('growth', $tenant->fresh()->plan_key);
    }

    public function test_billing_requires_permission_and_tenant_scoping(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($employee)->getJson('/api/v1/billing')->assertForbidden();
        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/billing/checkout', ['plan' => 'starter'])
            ->assertForbidden();

        // A reference belonging to another tenant can't be verified.
        $other = $this->createTenant('other', 'Other Ltd');
        BillingPayment::withoutGlobalScopes()->create([
            'tenant_id' => $other->id,
            'plan_key' => 'starter',
            'amount' => 25_000,
            'reference' => 'g3n_foreign',
        ]);

        $ceo = $this->createUserWithRole($tenant, 'ceo');
        $this->actingAsTenantUser($ceo)
            ->postJson('/api/v1/billing/verify', ['reference' => 'g3n_foreign'])
            ->assertNotFound();
    }
}
