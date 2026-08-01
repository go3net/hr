<?php

namespace Tests\Unit;

use App\Modules\Hr\Services\PayrollService;
use Tests\TestCase;

class PayeCalculationTest extends TestCase
{
    private PayrollService $payroll;

    protected function setUp(): void
    {
        parent::setUp();
        $this->payroll = new PayrollService();
    }

    public function test_progressive_tax_over_2026_bands(): void
    {
        $bands = config('payroll.paye_tables.2026.bands');

        // Inside the zero band.
        $this->assertSame(0.0, $this->payroll->progressiveTax(800_000, $bands));

        // 3,000,000: 800k @ 0% + 2.2m @ 15% = 330,000.
        $this->assertSame(330_000.0, $this->payroll->progressiveTax(3_000_000, $bands));

        // 5,520,000: 330,000 + 2,520,000 @ 18% = 783,600.
        $this->assertSame(783_600.0, $this->payroll->progressiveTax(5_520_000, $bands));
    }

    public function test_monthly_paye_for_500k_salary_no_allowances(): void
    {
        // ₦500,000/month, no allowances:
        //   annual gross 6,000,000; pension 8% = 40,000/mo (480,000/yr)
        //   taxable 5,520,000 → tax 783,600/yr → 65,300/mo
        $pension = $this->payroll->pensionEmployee(500_000, []);
        $this->assertSame(40_000.0, $pension);

        $paye = $this->payroll->payeMonthly(500_000, $pension, 2026);
        $this->assertEqualsWithDelta(65_300.0, $paye, 0.01);
    }

    public function test_pensionable_pay_includes_housing_and_transport_only(): void
    {
        $pay = $this->payroll->pensionablePay(400_000, [
            'housing' => 60_000,
            'transport' => 40_000,
            'meal' => 25_000, // not pensionable
        ]);

        $this->assertSame(500_000.0, $pay);
    }

    public function test_low_income_pays_no_tax_under_2026_table(): void
    {
        // ₦60,000/month → annual 720,000, inside the ₦800,000 zero band.
        $paye = $this->payroll->payeMonthly(60_000, 0, 2026);
        $this->assertSame(0.0, $paye);
    }

    public function test_historical_year_falls_back_to_legacy_cra_table(): void
    {
        // A 2025 run must use the 2011 PITA table (with CRA), not the 2026 one.
        $paye2025 = $this->payroll->payeMonthly(500_000, 40_000, 2025);
        $paye2026 = $this->payroll->payeMonthly(500_000, 40_000, 2026);

        $this->assertNotEquals($paye2025, $paye2026);
        $this->assertGreaterThan(0, $paye2025);
    }
}
