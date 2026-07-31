<?php

namespace App\Modules\Billing\Http;

use App\Core\Http\ApiController;
use App\Core\Tenancy\TenantContext;
use App\Models\BillingPayment;
use App\Modules\Billing\Services\BillingService;
use App\Modules\Billing\Services\PaystackGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BillingController extends ApiController
{
    public function __construct(
        private readonly BillingService $billing,
        private readonly PaystackGateway $paystack,
    ) {
    }

    /** Current subscription, the plan catalog, and payment history. */
    public function show(Request $request): JsonResponse
    {
        $this->requirePermission('settings.billing.manage');
        $tenant = app(TenantContext::class)->get();

        return $this->respond([
            'state' => $tenant->subscriptionState(),
            'plan_key' => $tenant->plan_key,
            'plan_name' => config("billing.plans.{$tenant->plan_key}.name"),
            'trial_ends_at' => $tenant->trial_ends_at?->toIso8601String(),
            'subscription_ends_at' => $tenant->subscription_ends_at?->toIso8601String(),
            'configured' => $this->paystack->isConfigured(),
            'plans' => collect(config('billing.plans'))
                ->map(fn (array $plan, string $key) => [
                    'key' => $key,
                    'name' => $plan['name'],
                    'price' => $plan['price'],
                    'max_employees' => $plan['max_employees'],
                    'blurb' => $plan['blurb'],
                    'features' => $plan['features'],
                ])
                ->values(),
            'payments' => BillingPayment::query()
                ->with('user:id,name')
                ->orderByDesc('created_at')
                ->limit(50)
                ->get()
                ->map(fn (BillingPayment $p) => [
                    'id' => $p->id,
                    'plan_key' => $p->plan_key,
                    'amount' => (float) $p->amount,
                    'reference' => $p->reference,
                    'status' => $p->status,
                    'channel' => $p->channel,
                    'paid_at' => $p->paid_at?->toIso8601String(),
                    'by' => $p->user?->name,
                    'created_at' => $p->created_at->toIso8601String(),
                ]),
        ]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $this->requirePermission('settings.billing.manage');

        $data = $request->validate([
            'plan' => ['required', 'string', 'in:'.implode(',', array_keys(config('billing.plans')))],
        ]);

        if (! $this->paystack->isConfigured()) {
            return $this->respondError(
                'BILLING_NOT_CONFIGURED',
                'Payments are not configured. Add PAYSTACK_SECRET_KEY to the API environment.',
                503,
            );
        }

        $result = $this->billing->startCheckout(
            app(TenantContext::class)->get(),
            $request->user(),
            $data['plan'],
        );

        return $this->respond($result, 201);
    }

    /** Callback-side confirmation once Paystack redirects the admin back. */
    public function verify(Request $request): JsonResponse
    {
        $this->requirePermission('settings.billing.manage');

        $data = $request->validate(['reference' => ['required', 'string', 'max:60']]);

        // Only references belonging to this tenant can be verified here.
        $owned = BillingPayment::query()->where('reference', $data['reference'])->exists();
        if (! $owned) {
            return $this->respondError('NOT_FOUND', 'Unknown payment reference.', 404);
        }

        $activated = $this->billing->verifyAndActivate($data['reference']);

        return $this->respond(['activated' => $activated]);
    }

    /** Paystack server-to-server webhook (unauthenticated, signature-checked). */
    public function webhook(Request $request): JsonResponse
    {
        if (! $this->paystack->validSignature($request->getContent(), $request->header('x-paystack-signature'))) {
            return $this->respondError('INVALID_SIGNATURE', 'Signature verification failed.', 401);
        }

        $event = $request->json('event');
        if ($event === 'charge.success') {
            $data = (array) $request->json('data');
            $handled = $this->billing->activate((string) ($data['reference'] ?? ''), $data);
            if (! $handled) {
                Log::warning('Paystack charge.success for unknown or underpaid reference', [
                    'reference' => $data['reference'] ?? null,
                ]);
            }
        }

        return $this->respond(['received' => true]);
    }
}
