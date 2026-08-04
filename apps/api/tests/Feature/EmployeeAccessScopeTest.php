<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

/**
 * A plain employee must not be able to read company-wide management
 * information — headcount, everyone's attendance, the org chart.
 */
class EmployeeAccessScopeTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function employeeFor(User $user, string $first): Employee
    {
        return Employee::withoutGlobalScopes()->create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'employee_code' => 'G3N-'.random_int(1000, 9999),
            'first_name' => $first,
            'last_name' => 'Test',
            'employment_type' => 'full_time',
            'status' => 'active',
            'hired_at' => now()->subMonths(6),
        ]);
    }

    public function test_employee_dashboard_returns_personal_figures_not_company_ones(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();

        $staff = $this->createUserWithRole($tenant, 'employee');
        $employee = $this->employeeFor($staff, 'Grace');

        // Company data that must not leak into the response.
        Department::withoutGlobalScopes()->create(['tenant_id' => $tenant->id, 'name' => 'Engineering']);
        $colleagueUser = $this->createUserWithRole($tenant, 'employee', ['email' => 'colleague@example.test']);
        $this->employeeFor($colleagueUser, 'Colleague');

        AttendanceRecord::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'employee_id' => $employee->id,
            'work_date' => now()->toDateString(),
            'clocked_in_at' => now()->subHours(3),
            'method' => 'web',
            'is_late' => false,
        ]);

        $response = $this->actingAs($staff)->getJson('/api/v1/dashboard/summary')->assertOk();

        $response->assertJsonPath('meta.scope', 'personal');
        $response->assertJsonPath('data.has_employee_record', true);
        $response->assertJsonPath('data.clocked_in', true);

        // The company aggregates must be absent entirely, not merely zeroed.
        $data = $response->json('data');
        $this->assertArrayNotHasKey('total_staff', $data);
        $this->assertArrayNotHasKey('departments', $data);
        $this->assertArrayNotHasKey('pending_leave', $data);
    }

    public function test_manager_still_sees_company_dashboard(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $this->employeeFor($hr, 'Hilda');

        $this->actingAs($hr)
            ->getJson('/api/v1/dashboard/summary')
            ->assertOk()
            ->assertJsonPath('meta.scope', 'company')
            ->assertJsonStructure(['data' => ['total_staff', 'departments', 'pending_leave']]);
    }

    public function test_employee_charts_carry_no_company_series(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $staff = $this->createUserWithRole($tenant, 'employee');
        $this->employeeFor($staff, 'Grace');

        Department::withoutGlobalScopes()->create(['tenant_id' => $tenant->id, 'name' => 'Engineering']);

        $this->actingAs($staff)
            ->getJson('/api/v1/dashboard/charts')
            ->assertOk()
            ->assertJsonPath('meta.scope', 'personal')
            ->assertJsonPath('data.headcount', [])
            ->assertJsonPath('data.attendance', [])
            ->assertJsonPath('data.active_staff', 0);
    }

    public function test_employee_attendance_is_scoped_to_their_own_records(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();

        $staff = $this->createUserWithRole($tenant, 'employee');
        $mine = $this->employeeFor($staff, 'Grace');

        $colleagueUser = $this->createUserWithRole($tenant, 'employee', ['email' => 'colleague@example.test']);
        $theirs = $this->employeeFor($colleagueUser, 'Colleague');

        foreach ([$mine->id, $theirs->id] as $employeeId) {
            AttendanceRecord::withoutGlobalScopes()->create([
                'tenant_id' => $tenant->id,
                'employee_id' => $employeeId,
                'work_date' => now()->toDateString(),
                'clocked_in_at' => now()->subHours(2),
                'method' => 'web',
                'is_late' => false,
            ]);
        }

        $rows = $this->actingAs($staff)->getJson('/api/v1/hr/attendance')->assertOk()->json('data');

        $this->assertCount(1, $rows, 'An employee should only see their own attendance.');
        $this->assertSame('Grace Test', $rows[0]['employee']);

        // Asking for someone else's records explicitly must not widen the scope.
        $filtered = $this->actingAs($staff)
            ->getJson('/api/v1/hr/attendance?employee_id='.$theirs->id)
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $filtered);
        $this->assertSame('Grace Test', $filtered[0]['employee']);
    }

    public function test_employee_cannot_reach_people_admin_endpoints(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $staff = $this->createUserWithRole($tenant, 'employee');
        $this->employeeFor($staff, 'Grace');

        foreach ([
            '/api/v1/hr/employees',
            '/api/v1/hr/departments',
            '/api/v1/hr/positions',
            '/api/v1/hr/payroll/runs',
            '/api/v1/hr/team',
            '/api/v1/settings/users',
            '/api/v1/settings/roles',
            '/api/v1/dashboard/activity',
        ] as $endpoint) {
            $this->actingAs($staff)
                ->getJson($endpoint)
                ->assertForbidden();
        }
    }
}
