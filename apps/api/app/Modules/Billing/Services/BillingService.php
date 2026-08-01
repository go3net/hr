<?php

namespace App\Modules\Billing\Services;

use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use App\Models\BillingPayment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BillingService
{
    public function __construct(private readonly PaystackGateway $paystack)
    {
    }

    /** @return array{authorization_url: string, reference: string} */
    public function startCheckout(Tenant $tenant, User $user, string $planKey): array
    {
        $plan = config("billing.plans.{$planKey}");
        if (! $plan) {
            throw ValidationException::withMessages(['plan' => 'Unknown plan.']);
        }

        $reference = 'g3n_'.Str::random(24);

        $payment = BillingPayment::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'plan_key' => $planKey,
            'amount' => $plan['price'],
            'reference' => $reference,
        ]);

        $session = $this->paystack->initialize(
            email: $user->email,
            amountKobo: (int) round($plan['price'] * 100),
            reference: $reference,
            callbackUrl: rtrim(config('app.frontend_url'), '/').'/settings/billing',
            metadata: ['tenant_id' => $tenant->id, 'plan' => $planKey],
        );

        return ['authorization_url' => $session['authorization_url'], 'reference' => $payment->reference];
    }

    /**
     * Mark a payment paid and extend the tenant's subscription. Idempotent —
     * webhook and callback verification can both land for the same charge.
     * Runs without tenant context (webhooks are unauthenticated), so queries
     * bypass global scopes and the context is set explicitly for audit logs.
     */
    public function activate(string $reference, array $verified): bool
    {
        $payment = BillingPayment::withoutGlobalScopes()->where('reference', $reference)->first();
        if (! $payment || ($verified['status'] ?? null) !== 'success') {
            return false;
        }
        if ($payment->status === 'paid') {
            return true;
        }

        // The charged amount must cover the plan price (kobo comparison).
        if ((int) ($verified['amount'] ?? 0) < (int) round($payment->amount * 100)) {
            $payment->update(['status' => 'failed']);

            return false;
        }

        $tenant = Tenant::query()->findOrFail($payment->tenant_id);
        app(TenantContext::class)->set($tenant);

        $payment->update([
            'status' => 'paid',
            'channel' => $verified['channel'] ?? null,
            'paid_at' => now(),
        ]);

        // Renewing early never loses time: extend from the later of now and
        // the current period end.
        $base = $tenant->subscription_ends_at?->isFuture()
            ? $tenant->subscription_ends_at
            : now();

        $tenant->update([
            'status' => 'active',
            'plan_key' => $payment->plan_key,
            'subscription_ends_at' => $base->copy()->addMonth(),
        ]);

        AuditLog::record('billing.subscription_activated', $payment, [
            'plan' => $payment->plan_key,
            'period_ends' => $tenant->subscription_ends_at->toIso8601String(),
        ]);

        return true;
    }

    /** Fallback used by the frontend callback: ask Paystack, then activate. */
    public function verifyAndActivate(string $reference): bool
    {
        return $this->activate($reference, $this->paystack->verify($reference));
    }
}
