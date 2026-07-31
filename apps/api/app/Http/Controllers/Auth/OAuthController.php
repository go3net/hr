<?php

namespace App\Http\Controllers\Auth;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Socialite\Facades\Socialite;

class OAuthController extends ApiController
{
    private const PROVIDERS = ['google', 'microsoft', 'github'];

    /** SPA asks for the provider's authorization URL. */
    public function redirect(string $provider): JsonResponse
    {
        $this->assertProvider($provider);

        $url = Socialite::driver($provider)
            ->stateless()
            ->redirect()
            ->getTargetUrl();

        return $this->respond(['url' => $url]);
    }

    /**
     * Provider redirects here. We match a verified email to an existing
     * workspace user, mint a one-time exchange code, and bounce the
     * browser back to the frontend — the token never rides in a URL.
     */
    public function callback(string $provider): RedirectResponse
    {
        $this->assertProvider($provider);

        $frontend = rtrim(config('app.frontend_url', 'http://localhost:3000'), '/');

        try {
            $oauthUser = Socialite::driver($provider)->stateless()->user();
        } catch (\Throwable) {
            return redirect()->away("{$frontend}/login?oauth_error=provider_failed");
        }

        $email = $oauthUser->getEmail();
        if (! $email) {
            return redirect()->away("{$frontend}/login?oauth_error=no_email");
        }

        $user = User::query()->where('email', $email)->first();
        if (! $user || $user->status !== 'active') {
            // OAuth is sign-in, not sign-up: the workspace account must exist.
            return redirect()->away("{$frontend}/login?oauth_error=no_account");
        }

        $user->forceFill(['provider' => $provider, 'provider_id' => (string) $oauthUser->getId()])->save();

        $code = Str::random(48);
        Cache::put("oauth-exchange:{$code}", $user->id, now()->addMinutes(2));

        return redirect()->away("{$frontend}/login?oauth_code={$code}");
    }

    /** SPA swaps the one-time code for a token (or a 2FA challenge). */
    public function exchange(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string']]);

        $userId = Cache::pull("oauth-exchange:{$data['code']}");
        if (! $userId) {
            throw ValidationException::withMessages(['code' => 'This sign-in link expired. Try again.']);
        }

        $user = User::query()->findOrFail($userId);

        if ($user->hasTwoFactorEnabled()) {
            $challenge = Str::random(48);
            Cache::put("2fa-challenge:{$challenge}", $user->id, now()->addMinutes(5));

            return $this->respond([
                'two_factor_required' => true,
                'challenge_token' => $challenge,
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        AuditLog::record('auth.oauth_login');

        return $this->respond([
            'token' => $user->createToken('oauth')->plainTextToken,
        ]);
    }

    private function assertProvider(string $provider): void
    {
        abort_unless(in_array($provider, self::PROVIDERS, true), 404);
    }
}
