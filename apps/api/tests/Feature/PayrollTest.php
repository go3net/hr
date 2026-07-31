<?php

namespace Tests\Feature;

use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class PayrollTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpPayroll(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $finance = $this->createUserWithRole($tenant, 'finance');
        $employeeUser = $this->createUserWithRole($tenant, 'employee');

        $employee = Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $employeeUser->id,
            'employee_code' => 'E-1',
            'first_name' => 'Test',
            'last_name' => 'Person',
            'base_salary' => 500_000,
        ]);

        return [$tenant, $finance, $employeeUser, $employee];
    }

    public function test_finance_can_draft_approve_and_publish_a_run(): void
    {
        [, $finance] = $this->setUpPayroll();

        $run = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.employees', 1)
            ->json('data');

        // ₦500k salary → pension 40,000, PAYE 65,300, net 394,700.
        $detail = $this->actingAsTenantUser($finance)
            ->getJson("/api/v1/hr/payroll/runs/{$run['id']}")
            ->assertOk()
            ->json('data');

        $item = $detail['items'][0];
        $this->assertEquals(500_000, $item['gross']);
        $this->assertEquals(40_000, $item['pension_employee']);
        $this->assertEqualsWithDelta(65_300, $item['paye_tax'], 0.01);
        $this->assertEqualsWithDelta(394_700, $item['net'], 0.01);

        $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/hr/payroll/runs/{$run['id']}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/hr/payroll/runs/{$run['id']}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', 'published');
    }

    public function test_duplicate_period_is_rejected(): void
    {
        [, $finance] = $this->setUpPayroll();

        $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->assertCreated();

        $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('period');
    }

    public function test_publish_requires_approval_first(): void
    {
        [, $finance] = $this->setUpPayroll();

        $run = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->json('data');

        $this->actingAsTenantUser($finance)
            ->postJson("/api/v1/hr/payroll/runs/{$run['id']}/publish")
            ->assertUnprocessable();
    }

    public function test_employee_cannot_manage_payroll_but_sees_own_payslips_after_publish(): void
    {
        [, $finance, $employeeUser] = $this->setUpPayroll();

        $this->actingAsTenantUser($employeeUser)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->assertForbidden();

        $run = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->json('data');

        // Nothing published yet → no payslips.
        $this->actingAsTenantUser($employeeUser)
            ->getJson('/api/v1/hr/payslips/mine')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$run['id']}/approve");
        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$run['id']}/publish");

        $slips = $this->actingAsTenantUser($employeeUser)
            ->getJson('/api/v1/hr/payslips/mine')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $slips);
        $this->assertSame('2026-07', $slips[0]['period']);
        $this->assertEqualsWithDelta(394_700, $slips[0]['net'], 0.01);
    }

    public function test_bank_export_only_after_publish(): void
    {
        [, $finance] = $this->setUpPayroll();

        $run = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->json('data');

        $this->actingAsTenantUser($finance)
            ->getJson("/api/v1/hr/payroll/runs/{$run['id']}/bank-export")
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'RUN_NOT_PUBLISHED');

        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$run['id']}/approve");
        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$run['id']}/publish");

        $rows = $this->actingAsTenantUser($finance)
            ->getJson("/api/v1/hr/payroll/runs/{$run['id']}/bank-export")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $rows);
        $this->assertSame('E-1', $rows[0]['employee_code']);
        $this->assertEqualsWithDelta(394_700, $rows[0]['amount'], 0.01);
    }
}
