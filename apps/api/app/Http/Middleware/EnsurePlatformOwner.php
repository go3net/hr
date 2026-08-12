<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The only door that reaches across tenants. Everything behind it is
 * account-level — which companies exist, what they pay, when their trial ends
 * — and nothing behind it reads a customer's HR data.
 */
class EnsurePlatformOwner
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->user()?->is_platform_owner, 403, 'This action is unauthorized.');

        return $next($request);
    }
}
