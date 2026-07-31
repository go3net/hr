<?php

namespace App\Core\Tenancy;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the tenant for the request, in priority order:
 *  1. the authenticated user's tenant (authoritative — a token can never
 *     reach another tenant by spoofing headers),
 *  2. the X-Tenant header (mobile / local dev),
 *  3. the request subdomain (acme.go3net.app).
 */
class ResolveTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenant = null;

        if ($user = $request->user()) {
            $tenant = $user->tenant;
        } elseif ($sub = $request->header('X-Tenant')) {
            $tenant = Tenant::query()->where('subdomain', $sub)->first();
        } else {
            $host = $request->getHost();
            $parts = explode('.', $host);
            if (count($parts) > 2) {
                $tenant = Tenant::query()->where('subdomain', $parts[0])->first();
            }
        }

        if ($tenant) {
            if ($tenant->status === 'suspended' || $tenant->status === 'cancelled') {
                return response()->json([
                    'error' => [
                        'code' => 'SUBSCRIPTION_INACTIVE',
                        'message' => 'This workspace is suspended. Contact your administrator.',
                    ],
                ], 403);
            }

            app(TenantContext::class)->set($tenant);
        }

        return $next($request);
    }
}
