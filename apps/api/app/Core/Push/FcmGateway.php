<?php

namespace App\Core\Push;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Minimal Firebase Cloud Messaging (HTTP v1) sender. Authenticates with a
 * service-account JSON via the OAuth2 JWT-bearer grant — no SDK required.
 * Unconfigured environments simply never send.
 */
class FcmGateway
{
    private const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    public function isConfigured(): bool
    {
        return $this->credentials() !== null;
    }

    /**
     * Send one push. Returns 'sent', 'invalid' (token should be pruned),
     * or 'failed' (transient — keep the token).
     */
    public function send(string $deviceToken, string $title, string $body, array $data = []): string
    {
        $credentials = $this->credentials();
        if (! $credentials) {
            return 'failed';
        }

        $accessToken = $this->accessToken($credentials);
        if ($accessToken === null) {
            return 'failed';
        }

        $response = Http::withToken($accessToken)
            ->timeout(15)
            ->post("https://fcm.googleapis.com/v1/projects/{$credentials['project_id']}/messages:send", [
                'message' => [
                    'token' => $deviceToken,
                    'notification' => ['title' => $title, 'body' => $body],
                    'data' => array_map(strval(...), $data),
                ],
            ]);

        if ($response->successful()) {
            return 'sent';
        }

        // UNREGISTERED / INVALID_ARGUMENT → the token is dead, prune it.
        $errorCode = $response->json('error.status');
        if (in_array($errorCode, ['UNREGISTERED', 'INVALID_ARGUMENT', 'NOT_FOUND'], true)) {
            return 'invalid';
        }

        Log::warning('FCM send failed', ['status' => $response->status(), 'error' => $errorCode]);

        return 'failed';
    }

    /** @return array{project_id: string, client_email: string, private_key: string}|null */
    private function credentials(): ?array
    {
        $raw = (string) config('services.fcm.credentials');
        if ($raw === '') {
            return null;
        }

        // Accepts inline JSON or a path to the service-account file.
        $json = str_starts_with(trim($raw), '{') ? $raw : (is_readable($raw) ? (string) file_get_contents($raw) : '');
        $decoded = json_decode($json, true);

        if (! is_array($decoded)
            || ! isset($decoded['project_id'], $decoded['client_email'], $decoded['private_key'])) {
            return null;
        }

        return [
            'project_id' => $decoded['project_id'],
            'client_email' => $decoded['client_email'],
            'private_key' => $decoded['private_key'],
        ];
    }

    /** OAuth2 access token via the signed-JWT bearer grant, cached ~55 min. */
    private function accessToken(array $credentials): ?string
    {
        return Cache::remember('fcm:access-token', 3300, function () use ($credentials) {
            $jwt = $this->signedJwt($credentials);
            if ($jwt === null) {
                return null;
            }

            $response = Http::asForm()->timeout(15)->post(self::TOKEN_URL, [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

            return $response->successful() ? $response->json('access_token') : null;
        });
    }

    private function signedJwt(array $credentials): ?string
    {
        $encode = fn (array $part) => rtrim(strtr(base64_encode(json_encode($part)), '+/', '-_'), '=');
        $now = time();

        $segments = $encode(['alg' => 'RS256', 'typ' => 'JWT']).'.'.$encode([
            'iss' => $credentials['client_email'],
            'scope' => self::SCOPE,
            'aud' => self::TOKEN_URL,
            'iat' => $now,
            'exp' => $now + 3600,
        ]);

        $key = openssl_pkey_get_private($credentials['private_key']);
        if ($key === false || ! openssl_sign($segments, $signature, $key, OPENSSL_ALGO_SHA256)) {
            Log::warning('FCM: could not sign service-account JWT');

            return null;
        }

        return $segments.'.'.rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    }
}
