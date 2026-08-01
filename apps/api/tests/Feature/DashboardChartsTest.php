<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
use App\Models\Department;
use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class DashboardChartsTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_charts_return_live_attendance_and_headcount_series(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $engineering = Department::create(['tenant_id' => $tenant->id, 'name' => 'Engineering']);
        $sales = Department::create(['tenant_id' => $tenant->id, 'name' => 'Sales']);

        $employees = collect([
            ['G3N-301', $engineering->id], ['G3N-302', $engineering->id], ['G3N-303', $sales->id],
        ])->map(fn ($pair) => Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'employee_code' => $pair[0],
            'first_name' => 'E',
            'last_name' => $pair[0],
            'department_id' => $pair[1],
            'employment_type' => 'full_time',
            'status' => 'active',
            'hired_at' => now()->subYear(),
        ]));

        // Two of three clocked in on the most recent weekday.
        $workday = now()->isWeekday() ? now() : now()->previous('Friday');
        foreach ($employees->take(2) as $employee) {
            AttendanceRecord::withoutGlobalScopes()->create([
                'tenant_id' => $tenant->id,
                'employee_id' => $employee->id,
                'work_date' => $workday->toDateString(),
                'clocked_in_at' => $workday->copy()->setTime(9, 0),
                'method' => 'web',
            ]);
        }

        $charts = $this->actingAsTenantUser($hr)
            ->getJson('/api/v1/dashboard/charts')
            ->assertOk()
            ->json('data');

        $this->assertCount(10, $charts['attendance']);
        $this->assertSame(3, $charts['active_staff']);

        $latest = collect($charts['attendance'])->last();
        $this->assertSame(2, $latest['present']);
        $this->assertSame(67, $latest['rate']); // 2 of 3 = 67%

        // Headcount sorted by size.
        $this->assertSame('Engineering', $charts['headcount'][0]['department']);
        $this->assertSame(2, $charts['headcount'][0]['count']);
        $this->assertSame(1, $charts['headcount'][1]['count']);
    }
}
