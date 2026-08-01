<?php

namespace App\Http\Controllers\Auth;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorController extends ApiController
{
    public function __construct(private readonly Google2FA $google2fa)
    {
    }

    /** Step 1: generate a secret; pending until the user confirms a code. */
    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasTwoFactorEnabled()) {
            return $this->respondError('ALREADY_ENABLED', 'Two-factor authentication is already enabled.', 422);
        }

        $secret = $this->google2fa->generateSecretKey(32);
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => null])->save();

        return $this->respond([
            'secret' => $secret,
            'otpauth_url' => $this->google2fa->getQRCodeUrl(
                config('app.name', 'Go3net Office'),
                $user->email,
                $secret,
            ),
        ]);
    }

    /** Step 2: confirm with a live code; recovery codes are shown once. */
    public function confirm(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $user = $request->user();

        if (! $user->two_factor_secret || $user->hasTwoFactorEnabled()) {
            return $this->respondError('NOT_PENDING', 'Start enrollment first.', 422);
        }

        if (! $this->google2fa->verifyKey($user->two_factor_secret, $data['code'])) {
            throw ValidationException::withMessages(['code' => 'That code is not valid. Check your authenticator app.']);
        }

        $recoveryCodes = collect(range(1, 8))
            ->map(fn () => Str::upper(Str::random(5).'-'.Str::random(5)))
            ->all();

        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => array_map(fn ($c) => Hash::make($c), $recoveryCodes),
        ])->save();

        AuditLog::record('auth.two_factor_enabled');

        return $this->respond(['recovery_codes' => $recoveryCodes]);
    }

    public function disable(Request $request): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string']]);
        $user = $request->user();

        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['password' => 'Password is incorrect.']);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        AuditLog::record('auth.two_factor_disabled');

        return $this->respond(['enabled' => false]);
    }

    /** Complete a login challenge with a TOTP or recovery code. */
    public function challenge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge_token' => ['required', 'string'],
            'code' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $userId = Cache::pull("2fa-challenge:{$data['challenge_token']}");
        if (! $userId) {
            throw ValidationException::withMessages(['challenge_token' => 'This sign-in attempt expired. Start again.']);
        }

        $user = \App\Models\User::query()->findOrFail($userId);

        if (! $this->verifyCode($user, $data['code'])) {
            // Re-arm the challenge so a typo doesn't force a full re-login.
            Cache::put("2fa-challenge:{$data['challenge_token']}", $userId, now()->addMinutes(5));
            throw ValidationException::withMessages(['code' => 'That code is not valid.']);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        AuditLog::record('auth.two_factor_login');

        return $this->respond([
            'token' => $user->createToken($data['device_name'] ?? 'api')->plainTextToken,
        ]);
    }

    private function verifyCode(\App\Models\User $user, string $code): bool
    {
        if ($this->google2fa->verifyKey((string) $user->two_factor_secret, $code)) {
            return true;
        }

        // Recovery codes are hashed and single-use.
        $codes = $user->two_factor_recovery_codes ?? [];
        foreach ($codes as $i => $hashed) {
            if (Hash::check(strtoupper($code), $hashed)) {
                unset($codes[$i]);
                $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

                return true;
            }
        }

        return false;
    }
}
