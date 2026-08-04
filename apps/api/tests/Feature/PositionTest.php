<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class PositionTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_position_crud_with_duplicate_and_in_use_guards(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $department = Department::create(['tenant_id' => $tenant->id, 'name' => 'Engineering']);

        $position = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/positions', [
                'title' => 'Backend Engineer', 'level' => 'Mid', 'department_id' => $department->id,
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('Backend Engineer', $position['title']);
        $this->assertSame('Engineering', $position['department']);
        $this->assertSame(0, $position['employees_count']);

        // Titles are unique per tenant.
        $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/positions', ['title' => 'Backend Engineer'])
            ->assertUnprocessable();

        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/positions/{$position['id']}", ['title' => 'Senior Backend Engineer', 'level' => 'Senior'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Senior Backend Engineer')
            ->assertJsonPath('data.level', 'Senior');

        // Occupied positions can't be deleted.
        $employee = Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id, 'employee_code' => 'G3N-950',
            'first_name' => 'Ify', 'last_name' => 'Eze', 'position_id' => $position['id'],
            'employment_type' => 'full_time', 'status' => 'active', 'hired_at' => now(),
        ]);
        $this->actingAsTenantUser($hr)
            ->deleteJson("/api/v1/hr/positions/{$position['id']}")
            ->assertUnprocessable();

        $employee->update(['position_id' => null]);
        $this->actingAsTenantUser($hr)
            ->deleteJson("/api/v1/hr/positions/{$position['id']}")
            ->assertNoContent();
    }

    public function test_admin_can_edit_an_employee(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $department = Department::create(['tenant_id' => $tenant->id, 'name' => 'Finance']);
        $position = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/positions', ['title' => 'Accountant'])
            ->json('data');

        $employee = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/employees', [
                'employee_code' => 'G3N-951', 'first_name' => 'Uche', 'last_name' => 'Nnamdi',
            ])
            ->assertCreated()
            ->json('data');

        $updated = $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/employees/{$employee['id']}", [
                'last_name' => 'Nnamdi-Okoro',
                'phone' => '08030000000',
                'department_id' => $department->id,
                'position_id' => $position['id'],
                'employment_type' => 'contract',
                'status' => 'on_leave',
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame('Uche Nnamdi-Okoro', $updated['name']);
        $this->assertSame('Finance', $updated['department']);
        $this->assertSame('Accountant', $updated['position']);
        $this->assertSame('contract', $updated['employment_type']);
        $this->assertSame('on_leave', $updated['status']);

        // The list carries the ids an edit form needs to prefill.
        $row = collect($this->actingAsTenantUser($hr)->getJson('/api/v1/hr/employees')->json('data'))
            ->firstWhere('employee_code', 'G3N-951');
        $this->assertSame($department->id, $row['department_id']);
        $this->assertSame($position['id'], $row['position_id']);
        $this->assertSame('Uche', $row['first_name']);

        // Employees without manage rights can't edit.
        $staff = $this->createUserWithRole($tenant, 'employee');
        $this->actingAsTenantUser($staff)
            ->patchJson("/api/v1/hr/employees/{$employee['id']}", ['first_name' => 'Nope'])
            ->assertForbidden();
    }
}
