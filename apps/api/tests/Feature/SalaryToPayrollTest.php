<?php

namespace Tests\Feature;

use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

/**
 * Payroll only includes employees who have a basic salary, and nothing in the
 * product could set one — so a run always found nobody. This walks the path
 * the UI now takes: set the salary structure on the employee, then run pay.
 */
class SalaryToPayrollTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_setting_a_salary_structure_lets_payroll_find_the_employee(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $employee = $this->actingAs($hr)
            ->postJson('/api/v1/hr/employees', [
                'employee_code' => 'G3N-0100',
                'first_name' => 'Ada',
                'last_name' => 'Obi',
                'employment_type' => 'full_time',
            ])
            ->assertCreated()
            ->json('data');

        // A run before any salary exists finds nobody.
        $this->actingAs($hr)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-03'])
            ->assertStatus(422);

        $this->actingAs($hr)
            ->patchJson("/api/v1/hr/employees/{$employee['id']}", [
                'base_salary' => 400000,
                'allowances' => ['Housing' => 100000, 'Transport' => 50000],
            ])
            ->assertOk();

        $this->assertSame(
            ['Housing' => 100000, 'Transport' => 50000],
            Employee::withoutGlobalScopes()->find($employee['employee_id'])->allowances,
        );

        $run = $this->actingAs($hr)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-03'])
            ->assertCreated()
            ->json('data');

        // Gross is basic plus allowances; PAYE and pension come off that.
        $detail = $this->actingAs($hr)
            ->getJson("/api/v1/hr/payroll/runs/{$run['id']}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $detail['items']);
        $this->assertEqualsWithDelta(550000, (float) $detail['items'][0]['gross'], 0.01);
        $this->assertGreaterThan(0, (float) $detail['items'][0]['net']);
        $this->assertLessThan(550000, (float) $detail['items'][0]['net']);
    }

    public function test_salary_is_hidden_from_staff_without_sensitive_clearance(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();

        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->actingAs($hr)
            ->postJson('/api/v1/hr/employees', [
                'employee_code' => 'G3N-0200',
                'first_name' => 'Tunde',
                'last_name' => 'Bello',
                'employment_type' => 'full_time',
                'base_salary' => 250000,
            ])
            ->assertCreated()
            ->json('data');

        // hr.employees.view without view_sensitive: the record loads, pay does not.
        $viewer = $this->createUserWithRole($tenant, 'department_manager', ['email' => 'dm@example.test']);

        $seen = $this->actingAs($viewer)
            ->getJson("/api/v1/hr/employees/{$employee['id']}")
            ->assertOk()
            ->json('data');

        $this->assertArrayNotHasKey('base_salary', $seen);
        $this->assertArrayNotHasKey('allowances', $seen);

        $this->assertArrayHasKey(
            'base_salary',
            $this->actingAs($hr)->getJson("/api/v1/hr/employees/{$employee['id']}")->json('data'),
        );
    }
}
