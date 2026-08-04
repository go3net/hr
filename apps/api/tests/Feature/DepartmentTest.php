<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class DepartmentTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_department_crud_with_duplicate_and_delete_guards(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $department = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/departments', ['name' => 'Engineering', 'code' => 'ENG'])
            ->assertCreated()
            ->json('data');
        $this->assertSame('Engineering', $department['name']);
        $this->assertSame(0, $department['employees_count']);

        // Duplicate names are a clean 422, not a database error.
        $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/departments', ['name' => 'Engineering'])
            ->assertUnprocessable();

        // Another tenant may reuse the same name.
        $other = $this->createTenant('beta', 'Beta Ltd');
        $otherHr = $this->createUserWithRole($other, 'hr_manager');
        $this->actingAsTenantUser($otherHr)
            ->postJson('/api/v1/hr/departments', ['name' => 'Engineering'])
            ->assertCreated();

        // Rename, and assign a department head.
        $head = Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id, 'employee_code' => 'G3N-900',
            'first_name' => 'Ada', 'last_name' => 'Nwosu', 'department_id' => $department['id'],
            'employment_type' => 'full_time', 'status' => 'active', 'hired_at' => now(),
        ]);

        $updated = $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/departments/{$department['id']}", [
                'name' => 'Engineering & Product', 'manager_id' => $head->id,
            ])
            ->assertOk()
            ->json('data');
        $this->assertSame('Engineering & Product', $updated['name']);
        $this->assertSame('Ada Nwosu', $updated['manager']);

        // Keeping its own name on update is allowed.
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/departments/{$department['id']}", ['name' => 'Engineering & Product'])
            ->assertOk();

        // Deleting is blocked while staff are attached.
        $this->actingAsTenantUser($hr)
            ->deleteJson("/api/v1/hr/departments/{$department['id']}")
            ->assertUnprocessable();

        $head->update(['department_id' => null]);
        $this->actingAsTenantUser($hr)
            ->deleteJson("/api/v1/hr/departments/{$department['id']}")
            ->assertNoContent();
        // Soft-deleted: the row remains but is out of every normal query.
        $this->assertNotNull(Department::withoutGlobalScopes()->find($department['id'])->deleted_at);
        $this->assertSame(0, Department::withoutGlobalScopes()
            ->where('tenant_id', $tenant->id)
            ->whereNull('deleted_at')
            ->count());
    }

    public function test_department_management_requires_permission(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($employee)->getJson('/api/v1/hr/departments')->assertForbidden();
        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/hr/departments', ['name' => 'Nope'])
            ->assertForbidden();
    }
}
