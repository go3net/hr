<?php

namespace App\Http\Controllers\Auth;

use App\Core\Http\ApiController;
use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends ApiController
{
    private const REQUEST_MESSAGE = 'If an account matches that email address, a password-reset link has been sent.';

    /** Request a reset link without revealing whether the email is registered. */
    public function sendLink(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
        ]);

        // The broker hashes its token at rest, expires it according to auth.php,
        // and applies its configured per-address throttle.
        Password::sendResetLink(['email' => Str::lower($data['email'])]);

        return $this->respond(['message' => self::REQUEST_MESSAGE]);
    }

    /** Consume a reset token, update the password, and invalidate existing API sessions. */
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'token' => ['required', 'string'],
            'password' => ['required', 'confirmed', PasswordRule::min(10)->letters()->numbers()],
        ]);

        $status = Password::reset([
            'email' => Str::lower($data['email']),
            'token' => $data['token'],
            'password' => $data['password'],
            'password_confirmation' => $data['password_confirmation'],
        ], function ($user, string $password): void {
            $user->forceFill([
                'password' => Hash::make($password),
                'remember_token' => Str::random(60),
            ])->save();

            // A reset is an account-recovery event: any previously issued API
            // credentials must stop working immediately.
            $user->tokens()->delete();
            app(TenantContext::class)->set($user->tenant);
            AuditLog::record('auth.password_reset', $user);
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => 'This password-reset link is invalid or has expired.',
            ]);
        }

        return $this->respond(['message' => 'Your password has been reset. You can now sign in.']);
    }
}
