<?php

namespace Tests\Feature;

use App\Models\CompanyAsset;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class LifecycleTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function makeEmployee(User $actor, string $code = 'G3N-200'): Employee
    {
        return Employee::withoutGlobalScopes()->create([
            'tenant_id' => $actor->tenant_id,
            'employee_code' => $code,
            'first_name' => 'Test',
            'last_name' => 'Employee',
            'employment_type' => 'full_time',
            'status' => 'active',
            'hired_at' => now(),
        ]);
    }

    public function test_onboarding_checklist_seed_toggle_and_progress(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->makeEmployee($hr);

        $started = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/onboarding/start")
            ->assertCreated()
            ->json('data');
        $this->assertCount(6, $started['tasks']);
        $this->assertSame(0, $started['progress']);

        // Starting twice is rejected; custom items can be added.
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/onboarding/start")
            ->assertUnprocessable();
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/onboarding", ['title' => 'Order branded T-shirt'])
            ->assertCreated();

        $taskId = $started['tasks'][0]['id'];
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/onboarding-tasks/{$taskId}/toggle")
            ->assertOk()
            ->assertJsonPath('data.status', 'done');

        $view = $this->actingAsTenantUser($hr)
            ->getJson("/api/v1/hr/employees/{$employee->public_id}/onboarding")
            ->json('data');
        $this->assertSame((int) round(1 / 7 * 100), $view['progress']);

        // The onboarding index lists this employee.
        $index = $this->actingAsTenantUser($hr)->getJson('/api/v1/hr/onboarding')->json('data');
        $this->assertCount(1, $index);
        $this->assertSame(7, $index[0]['total']);
    }

    public function test_asset_register_assignment_and_return(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->makeEmployee($hr);

        $asset = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/assets', [
                'name' => 'MacBook Pro 14"', 'tag' => 'G3N-LAP-01', 'category' => 'laptop', 'serial_number' => 'C02XYZ',
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('available', $asset['status']);

        // Duplicate tag rejected.
        $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/assets', ['name' => 'Dup', 'tag' => 'G3N-LAP-01'])
            ->assertUnprocessable();

        $assigned = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/assets/{$asset['id']}/assign", ['employee_id' => $employee->id])
            ->assertOk()
            ->json('data');
        $this->assertSame('assigned', $assigned['status']);
        $this->assertSame('Test Employee', $assigned['assigned_to']);

        // Double-assign and status restatement blocked while out.
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/assets/{$asset['id']}/assign", ['employee_id' => $employee->id])
            ->assertUnprocessable();
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/assets/{$asset['id']}", ['status' => 'retired'])
            ->assertUnprocessable();

        $returned = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/assets/{$asset['id']}/return", ['condition_note' => 'Good condition'])
            ->assertOk()
            ->json('data');
        $this->assertSame('available', $returned['status']);

        $history = $this->actingAsTenantUser($hr)
            ->getJson("/api/v1/hr/assets/{$asset['id']}/history")
            ->json('data');
        $this->assertCount(1, $history);
        $this->assertNotNull($history[0]['returned_at']);
        $this->assertSame('Good condition', $history[0]['condition_note']);
    }

    public function test_exit_clearance_blocks_until_tasks_done_and_assets_returned(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->makeEmployee($hr);

        // Employee holds a laptop.
        $asset = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/assets', ['name' => 'ThinkPad', 'tag' => 'G3N-LAP-02'])
            ->json('data');
        $this->actingAsTenantUser($hr)->postJson("/api/v1/hr/assets/{$asset['id']}/assign", ['employee_id' => $employee->id]);

        $exit = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/exits", [
                'reason' => 'resignation',
                'last_working_day' => now()->addDays(30)->toDateString(),
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('clearance', $exit['status']);
        $this->assertCount(5, $exit['tasks']);

        // A second exit can't be opened while one is running.
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/exits", [
                'reason' => 'other', 'last_working_day' => now()->toDateString(),
            ])
            ->assertUnprocessable();

        // Completion blocked: tasks pending.
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/exits/{$exit['id']}/complete")
            ->assertUnprocessable();

        foreach ($exit['tasks'] as $task) {
            $this->actingAsTenantUser($hr)->patchJson("/api/v1/hr/exit-tasks/{$task['id']}/toggle")->assertOk();
        }

        // Still blocked: laptop not returned.
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/exits/{$exit['id']}/complete")
            ->assertUnprocessable();

        $this->actingAsTenantUser($hr)->postJson("/api/v1/hr/assets/{$asset['id']}/return");

        $completed = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/exits/{$exit['id']}/complete")
            ->assertOk()
            ->json('data');
        $this->assertSame('completed', $completed['status']);
        $this->assertSame('exited', Employee::withoutGlobalScopes()->find($employee->id)->status);
    }

    public function test_lifecycle_requires_permissions(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employeeUser = $this->createUserWithRole($tenant, 'employee');
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->makeEmployee($hr, 'G3N-201');

        $this->actingAsTenantUser($employeeUser)->getJson('/api/v1/hr/assets')->assertForbidden();
        $this->actingAsTenantUser($employeeUser)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/onboarding/start")
            ->assertForbidden();
        $this->actingAsTenantUser($employeeUser)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/exits", [
                'reason' => 'other', 'last_working_day' => now()->toDateString(),
            ])
            ->assertForbidden();
    }
}
