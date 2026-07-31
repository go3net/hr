<?php

namespace App\Http\Controllers\Auth;

use App\Core\Http\ApiController;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginController extends ApiController
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $throttleKey = strtolower($data['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 10)) {
            throw ValidationException::withMessages([
                'email' => 'Too many attempts. Try again in '.RateLimiter::availableIn($throttleKey).' seconds.',
            ]);
        }

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($throttleKey, 60);

            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        if ($user->status !== 'active') {
            throw ValidationException::withMessages([
                'email' => 'This account is disabled. Contact your administrator.',
            ]);
        }

        RateLimiter::clear($throttleKey);

        // 2FA-enrolled users get a short-lived challenge instead of a token.
        if ($user->hasTwoFactorEnabled()) {
            $challenge = Str::random(48);
            Cache::put("2fa-challenge:{$challenge}", $user->id, now()->addMinutes(5));

            return $this->respond([
                'two_factor_required' => true,
                'challenge_token' => $challenge,
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return $this->respond([
            'token' => $user->createToken($data['device_name'] ?? 'api')->plainTextToken,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return $this->respond(null, 200);
    }
}
