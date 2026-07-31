<?php

namespace App\Core\Http;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
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
}
