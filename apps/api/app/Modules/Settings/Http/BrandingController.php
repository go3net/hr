<?php

namespace App\Modules\Settings\Http;

use App\Core\Http\ApiController;
use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class BrandingController extends ApiController
{
    private const HEX = 'regex:/^#[0-9a-fA-F]{6}$/';

    public function show(Request $request): JsonResponse
    {
        $tenant = app(TenantContext::class)->get();

        return $this->respond($this->present($tenant->branding ?? []));
    }

    public function update(Request $request): JsonResponse
    {
        $this->requirePermission('settings.branding.manage');

        $data = $request->validate([
            'display_name' => ['sometimes', 'nullable', 'string', 'max:80'],
            'primary_color' => ['sometimes', 'nullable', 'string', self::HEX],
            'accent_color' => ['sometimes', 'nullable', 'string', self::HEX],
        ]);

        $tenant = app(TenantContext::class)->get();
        $branding = collect($tenant->branding ?? [])
            ->merge($data)
            ->filter(fn ($value) => $value !== null)
            ->all();
        // Explicit nulls clear a setting.
        foreach ($data as $key => $value) {
            if ($value === null) {
                unset($branding[$key]);
            }
        }

        $tenant->update(['branding' => $branding]);
        AuditLog::record('settings.branding_updated', $tenant, array_keys($data));

        return $this->respond($this->present($branding));
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $this->requirePermission('settings.branding.manage');

        $request->validate([
            'logo' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp,svg', 'max:2048'],
        ]);

        $tenant = app(TenantContext::class)->get();
        $file = $request->file('logo');
        $path = $file->storeAs(
            "tenants/{$tenant->id}/branding",
            'logo.'.$file->getClientOriginalExtension(),
        );

        $branding = [...($tenant->branding ?? []), 'logo_path' => $path];
        $tenant->update(['branding' => $branding]);

        return $this->respond($this->present($branding));
    }

    /** Streams the tenant logo to any signed-in member (img tags via BFF). */
    public function logo(Request $request): Response
    {
        $tenant = app(TenantContext::class)->get();
        $path = $tenant->branding['logo_path'] ?? null;

        if (! $path || ! Storage::exists($path)) {
            return response()->json(['error' => ['code' => 'NOT_FOUND', 'message' => 'No logo uploaded.']], 404);
        }

        return Storage::response($path, 'logo', ['Cache-Control' => 'private, max-age=300']);
    }

    private function present(array $branding): array
    {
        return [
            'display_name' => $branding['display_name'] ?? null,
            'primary_color' => $branding['primary_color'] ?? null,
            'accent_color' => $branding['accent_color'] ?? null,
            'has_logo' => isset($branding['logo_path']),
        ];
    }
}
