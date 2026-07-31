<?php

namespace App\Core\Modules;

use App\Core\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route middleware: module:{key}. Rejects requests for modules the tenant
 * has disabled (or that are not in the catalog).
 */
class EnsureModuleEnabled
{
    public function handle(Request $request, Closure $next, string $moduleKey): Response
    {
        $tenant = app(TenantContext::class)->get();

        if (! $tenant || ! $tenant->hasModuleEnabled($moduleKey)) {
            return response()->json([
                'error' => [
                    'code' => 'MODULE_DISABLED',
                    'message' => "The {$moduleKey} module is not enabled for this workspace.",
                ],
            ], 403);
        }

        return $next($request);
    }
}
