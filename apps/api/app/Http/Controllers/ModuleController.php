<?php

namespace App\Http\Controllers;

use App\Core\Http\ApiController;
use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use App\Models\Module;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModuleController extends ApiController
{
    public function index(): JsonResponse
    {
        $tenant = app(TenantContext::class)->get();

        return $this->respond(
            $tenant->modules()->orderBy('sort_order')->get()->map(fn (Module $m) => [
                'key' => $m->key,
                'name' => $m->name,
                'description' => $m->description,
                'is_core' => $m->is_core,
                'enabled' => (bool) $m->pivot->enabled,
            ]),
        );
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $this->requirePermission('settings.modules.manage');

        $data = $request->validate(['enabled' => ['required', 'boolean']]);

        $tenant = app(TenantContext::class)->get();
        $module = Module::query()->where('key', $key)->firstOrFail();

        if ($module->is_core && ! $data['enabled']) {
            return $this->respondError('MODULE_IS_CORE', 'Core modules cannot be disabled.', 422);
        }

        $tenant->modules()->syncWithoutDetaching([
            $module->id => ['enabled' => $data['enabled']],
        ]);

        AuditLog::record($data['enabled'] ? 'module.enabled' : 'module.disabled', $module);

        return $this->respond(['key' => $key, 'enabled' => $data['enabled']]);
    }
}
