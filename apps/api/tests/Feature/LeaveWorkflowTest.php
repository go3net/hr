<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\LeaveType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class LeaveWorkflowTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpLeave(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employeeUser = $this->createUserWithRole($tenant, 'employee');
        $hrUser = $this->createUserWithRole($tenant, 'hr_manager');

        $employee = Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $employeeUser->id,
            'employee_code' => 'E-1',
            'first_name' => 'Test',
            'last_name' => 'Person',
        ]);

        $type = LeaveType::create([
            'tenant_id' => $tenant->id,
            'name' => 'Annual',
            'days_per_year' => 20,
        ]);

        return [$tenant, $employeeUser, $hrUser, $employee, $type];
    }

    public function test_employee_can_submit_and_hr_can_approve_leave(): void
    {
        [, $employeeUser, $hrUser, , $type] = $this->setUpLeave();

        // Mon 2026-08-03 → Fri 2026-08-07 = 5 working days
        $response = $this->actingAsTenantUser($employeeUser)
            ->postJson('/api/v1/hr/leave-requests', [
                'leave_type_id' => $type->id,
                'start_date' => '2026-08-03',
                'end_date' => '2026-08-07',
                'reason' => 'Family time',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $this->assertEquals(5, $response->json('data.days'));

        $id = $response->json('data.id');

        $this->actingAsTenantUser($hrUser)
            ->postJson("/api/v1/hr/leave-requests/{$id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        // Balance reflects the deduction.
        $balances = $this->actingAsTenantUser($employeeUser)
            ->getJson('/api/v1/hr/leave-balances?year=2026')
            ->assertOk()
            ->json('data');

        $annual = collect($balances)->firstWhere('type', 'Annual');
        $this->assertEquals(5, $annual['used']);
        $this->assertEquals(15, $annual['remaining']);
    }

    public function test_insufficient_balance_is_rejected(): void
    {
        [, $employeeUser, , , $type] = $this->setUpLeave();

        $type->update(['days_per_year' => 2]);

        $this->actingAsTenantUser($employeeUser)
            ->postJson('/api/v1/hr/leave-requests', [
                'leave_type_id' => $type->id,
                'start_date' => '2026-08-03',
                'end_date' => '2026-08-07',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('days');
    }

    public function test_employee_cannot_approve_leave(): void
    {
        [, $employeeUser, , , $type] = $this->setUpLeave();

        $id = $this->actingAsTenantUser($employeeUser)
            ->postJson('/api/v1/hr/leave-requests', [
                'leave_type_id' => $type->id,
                'start_date' => '2026-08-03',
                'end_date' => '2026-08-04',
            ])
            ->json('data.id');

        $this->actingAsTenantUser($employeeUser)
            ->postJson("/api/v1/hr/leave-requests/{$id}/approve")
            ->assertForbidden();
    }

    public function test_overlapping_requests_are_rejected(): void
    {
        [, $employeeUser, , , $type] = $this->setUpLeave();

        $this->actingAsTenantUser($employeeUser)
            ->postJson('/api/v1/hr/leave-requests', [
                'leave_type_id' => $type->id,
                'start_date' => '2026-08-03',
                'end_date' => '2026-08-07',
            ])
            ->assertCreated();

        $this->actingAsTenantUser($employeeUser)
            ->postJson('/api/v1/hr/leave-requests', [
                'leave_type_id' => $type->id,
                'start_date' => '2026-08-05',
                'end_date' => '2026-08-10',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('start_date');
    }
}
