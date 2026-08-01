<?php

namespace App\Modules\Settings\Http;

use App\Core\Http\ApiController;
use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RoleController extends ApiController
{
    /** System roles + this tenant's custom roles. */
    public function index(Request $request): JsonResponse
    {
        $this->requirePermission('settings.roles.manage');
        $tenant = app(TenantContext::class)->get();

        $roles = Role::query()
            ->where(fn ($q) => $q->whereNull('tenant_id')->orWhere('tenant_id', $tenant->id))
            ->with('permissions:id,key')
            ->withCount(['users' => fn ($q) => $q->where('tenant_id', $tenant->id)])
            ->orderByDesc('is_system')
            ->orderBy('name')
            ->get()
            ->map(fn (Role $role) => $this->present($role));

        return $this->respond($roles);
    }

    /** The permission catalog, for the role editor. */
    public function permissions(Request $request): JsonResponse
    {
        $this->requirePermission('settings.roles.manage');

        return $this->respond(
            Permission::query()
                ->orderBy('key')
                ->get(['key', 'label'])
                ->map(fn (Permission $p) => [
                    'key' => $p->key,
                    'label' => $p->label,
                    'group' => explode('.', $p->key)[0],
                ]),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('settings.roles.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:60'],
            'permissions' => ['required', 'array', 'min:1'],
            'permissions.*' => ['string', 'exists:permissions,key'],
        ]);

        $tenant = app(TenantContext::class)->get();
        $base = Str::slug($data['name'], '_') ?: 'role';
        $key = $base;
        $n = 2;
        while (Role::query()->where('tenant_id', $tenant->id)->where('key', $key)->exists()) {
            $key = "{$base}_{$n}";
            $n++;
        }

        $role = Role::create([
            'tenant_id' => $tenant->id,
            'key' => $key,
            'name' => $data['name'],
            'is_system' => false,
        ]);
        $role->permissions()->sync(
            Permission::query()->whereIn('key', $data['permissions'])->pluck('id'),
        );

        AuditLog::record('settings.role_created', $role, ['name' => $role->name]);

        return $this->respond($this->present($role->load('permissions:id,key')->loadCount('users')), 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $this->requirePermission('settings.roles.manage');
        $this->assertCustom($role);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:60'],
            'permissions' => ['sometimes', 'array', 'min:1'],
            'permissions.*' => ['string', 'exists:permissions,key'],
        ]);

        if (isset($data['name'])) {
            $role->update(['name' => $data['name']]);
        }
        if (isset($data['permissions'])) {
            $role->permissions()->sync(
                Permission::query()->whereIn('key', $data['permissions'])->pluck('id'),
            );
        }

        return $this->respond($this->present($role->fresh()->load('permissions:id,key')->loadCount('users')));
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        $this->requirePermission('settings.roles.manage');
        $this->assertCustom($role);

        AuditLog::record('settings.role_deleted', $role, ['name' => $role->name]);
        $role->users()->detach();
        $role->permissions()->detach();
        $role->delete();

        return $this->respond(null, 204);
    }

    /** Workspace members with their roles, for assignment. */
    public function users(Request $request): JsonResponse
    {
        $this->requirePermission('settings.roles.manage');
        $tenant = app(TenantContext::class)->get();

        return $this->respond(
            User::query()
                ->where('tenant_id', $tenant->id)
                ->with('roles:id,key,name')
                ->orderBy('name')
                ->limit(300)
                ->get()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'roles' => $user->roles->map->only(['id', 'key', 'name'])->values(),
                ]),
        );
    }

    /** Replace a member's roles. */
    public function assign(Request $request, User $member): JsonResponse
    {
        $this->requirePermission('settings.roles.manage');
        $tenant = app(TenantContext::class)->get();

        if ($member->tenant_id !== $tenant->id) {
            return $this->respondError('NOT_FOUND', 'User not found in this workspace.', 404);
        }

        $data = $request->validate([
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['integer'],
        ]);

        $valid = Role::query()
            ->whereIn('id', $data['role_ids'])
            ->where(fn ($q) => $q->whereNull('tenant_id')->orWhere('tenant_id', $tenant->id))
            ->pluck('id');
        if ($valid->count() !== count(array_unique($data['role_ids']))) {
            return $this->respondError('VALIDATION', 'One or more roles are invalid.', 422);
        }

        // Nobody may strip their own super_admin — prevents lockouts.
        if ($member->id === $request->user()->id && $member->hasRole('super_admin')) {
            $superAdminId = Role::query()->whereNull('tenant_id')->where('key', 'super_admin')->value('id');
            if (! $valid->contains($superAdminId)) {
                return $this->respondError('VALIDATION', 'You cannot remove your own Super Admin role.', 422);
            }
        }

        $member->roles()->sync($valid);
        AuditLog::record('settings.roles_assigned', $member, ['roles' => $valid->all()]);

        return $this->respond([
            'id' => $member->id,
            'roles' => $member->fresh()->roles->map->only(['id', 'key', 'name'])->values(),
        ]);
    }

    private function assertCustom(Role $role): void
    {
        $tenant = app(TenantContext::class)->get();
        if ($role->is_system || $role->tenant_id !== $tenant->id) {
            abort(response()->json([
                'error' => ['code' => 'FORBIDDEN', 'message' => 'System roles cannot be modified.'],
            ], 403));
        }
    }

    private function present(Role $role): array
    {
        return [
            'id' => $role->id,
            'key' => $role->key,
            'name' => $role->name,
            'is_system' => $role->is_system,
            'permissions' => $role->permissions->pluck('key')->values(),
            'members' => $role->users_count ?? 0,
        ];
    }
}
