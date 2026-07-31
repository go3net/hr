<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Modules\Hr\Jobs\GeneratePayslipPdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class PayrollAdjustmentTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpRun(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $finance = $this->createUserWithRole($tenant, 'finance');
        $employeeUser = $this->createUserWithRole($tenant, 'employee');

        Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $employeeUser->id,
            'employee_code' => 'E-1',
            'first_name' => 'Test',
            'last_name' => 'Person',
            'base_salary' => 500_000,
        ]);

        $run = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->json('data');

        $detail = $this->actingAsTenantUser($finance)
            ->getJson("/api/v1/hr/payroll/runs/{$run['id']}")
            ->json('data');

        return [$finance, $employeeUser, $run['id'], $detail['items'][0]['id']];
    }

    public function test_bonus_is_taxed_and_deduction_is_post_tax(): void
    {
        [$finance, , $runId, $itemId] = $this->setUpRun();

        // +100,000 bonus, -20,000 loan repayment on a ₦500k salary.
        $item = $this->actingAsTenantUser($finance)
            ->patchJson("/api/v1/hr/payroll/runs/{$runId}/items/{$itemId}", [
                'bonuses' => ['performance' => 100_000],
                'deductions' => ['loan' => 20_000],
            ])
            ->assertOk()
            ->json('data');

        // Gross 600,000; pension still 40,000 (bonus not pensionable);
        // annual taxable 7,200,000 - 480,000 = 6,720,000
        //   → 330,000 + 3,720,000*18% = 999,600/yr = 83,300/mo
        // Net = 600,000 - 40,000 - 83,300 - 20,000 = 456,700.
        $this->assertEquals(600_000, $item['gross']);
        $this->assertEquals(40_000, $item['pension_employee']);
        $this->assertEqualsWithDelta(83_300, $item['paye_tax'], 0.01);
        $this->assertEqualsWithDelta(456_700, $item['net'], 0.01);

        // Run totals were recomputed.
        $run = $this->actingAsTenantUser($finance)
            ->getJson("/api/v1/hr/payroll/runs/{$runId}")
            ->json('data');
        $this->assertEquals(600_000, $run['gross_total']);
        $this->assertEqualsWithDelta(456_700, $run['net_total'], 0.01);
    }

    public function test_adjusting_a_non_draft_run_is_rejected(): void
    {
        [$finance, , $runId, $itemId] = $this->setUpRun();

        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$runId}/approve");

        $this->actingAsTenantUser($finance)
            ->patchJson("/api/v1/hr/payroll/runs/{$runId}/items/{$itemId}", [
                'bonuses' => ['x' => 1000],
            ])
            ->assertUnprocessable();
    }

    public function test_publish_queues_payslip_generation(): void
    {
        Queue::fake();
        [$finance, , $runId] = $this->setUpRun();

        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$runId}/approve");
        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$runId}/publish");

        Queue::assertPushed(GeneratePayslipPdf::class, 1);
    }

    public function test_payslip_pdf_is_generated_and_downloadable_by_owner_only(): void
    {
        Storage::fake();
        [$finance, $employeeUser, $runId, $itemId] = $this->setUpRun();

        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$runId}/approve");
        // Sync queue in tests: publish runs the PDF jobs inline.
        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$runId}/publish");

        // The owner downloads their payslip.
        $response = $this->actingAsTenantUser($employeeUser)
            ->get("/api/v1/hr/payslips/{$itemId}/download");
        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('content-type'));

        // A second employee without payroll rights cannot.
        $tenant = $employeeUser->tenant;
        $stranger = $this->createUserWithRole($tenant, 'employee');
        Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $stranger->id,
            'employee_code' => 'E-2',
            'first_name' => 'Other',
            'last_name' => 'Person',
        ]);

        $this->actingAsTenantUser($stranger)
            ->get("/api/v1/hr/payslips/{$itemId}/download")
            ->assertForbidden();
    }
}
