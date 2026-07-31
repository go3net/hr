<?php

namespace App\Modules\Billing\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/** Thin wrapper over the Paystack REST API. */
class PaystackGateway
{
    public function isConfigured(): bool
    {
        return (string) config('billing.paystack.secret_key') !== '';
    }

    /**
     * Create a hosted checkout session.
     *
     * @param  int  $amountKobo  Amount in kobo (₦ × 100).
     * @return array{authorization_url: string, access_code: string, reference: string}
     */
    public function initialize(string $email, int $amountKobo, string $reference, string $callbackUrl, array $metadata = []): array
    {
        $data = $this->request()->post('/transaction/initialize', [
            'email' => $email,
            'amount' => $amountKobo,
            'currency' => 'NGN',
            'reference' => $reference,
            'callback_url' => $callbackUrl,
            'metadata' => $metadata,
        ])->throw()->json();

        if (! ($data['status'] ?? false)) {
            throw new RuntimeException($data['message'] ?? 'Paystack rejected the checkout request.');
        }

        return $data['data'];
    }

    /** Look up a transaction's final state. */
    public function verify(string $reference): array
    {
        $data = $this->request()->get("/transaction/verify/{$reference}")->throw()->json();

        if (! ($data['status'] ?? false)) {
            throw new RuntimeException($data['message'] ?? 'Paystack could not verify the transaction.');
        }

        return $data['data'];
    }

    /** Webhook authenticity: HMAC-SHA512 of the raw body with the secret key. */
    public function validSignature(string $rawBody, ?string $signature): bool
    {
        if ($signature === null || ! $this->isConfigured()) {
            return false;
        }

        $expected = hash_hmac('sha512', $rawBody, (string) config('billing.paystack.secret_key'));

        return hash_equals($expected, $signature);
    }

    private function request(): \Illuminate\Http\Client\PendingRequest
    {
        return Http::withToken((string) config('billing.paystack.secret_key'))
            ->baseUrl(rtrim((string) config('billing.paystack.base_url'), '/'))
            ->timeout(30)
            ->acceptJson();
    }
}
