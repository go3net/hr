<?php

namespace App\Core\Http;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

abstract class ApiController extends Controller
{
    protected function respond(mixed $data, int $status = 200, array $meta = []): JsonResponse
    {
        $payload = ['data' => $data];
        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }

    protected function respondError(string $code, string $message, int $status, array $fields = []): JsonResponse
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== []) {
            $error['fields'] = $fields;
        }

        return response()->json(['error' => $error], $status);
    }

    /** Authorize against a permission key (module.resource.action). */
    protected function requirePermission(string $permission): void
    {
        Gate::authorize('permission', [$permission]);
    }

    /**
     * Read a list filter, whatever spelling the client used.
     *
     * `?filter.status=open` looks natural and reads well in a URL, but PHP
     * rewrites dots in parameter names to underscores before Laravel ever
     * sees them, so `$request->query('filter.status')` matches nothing and
     * the filter silently does nothing — the caller gets an unfiltered list
     * and no error. Accepting every spelling here means a filter that looks
     * applied actually is.
     */
    protected function filterParam(Request $request, string $name): mixed
    {
        foreach (["filter_{$name}", $name] as $key) {
            $value = $request->query($key);
            if ($value !== null && $value !== '') {
                return $value;
            }
        }

        // ?filter[status]=open — a real nested array rather than a flat key.
        $nested = $request->query('filter');

        return is_array($nested) && ($nested[$name] ?? '') !== '' ? $nested[$name] : null;
    }
}
