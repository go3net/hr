<?php

namespace App\Modules\Hr\Services;

use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\User;
use App\Modules\Hr\Jobs\GeneratePayslipPdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayrollService
{
    /**
     * Draft a payroll run for a period (YYYY-MM): one item per active
     * employee with a salary, computed with the tax table for that year.
     */
    public function createRun(string $period, User $creator): PayrollRun
    {
        if (PayrollRun::query()->where('period', $period)->exists()) {
            throw ValidationException::withMessages([
                'period' => "A payroll run for {$period} already exists.",
            ]);
        }

        $employees = Employee::query()
            ->where('status', '!=', 'exited')
            ->whereNotNull('base_salary')
            ->get();

        if ($employees->isEmpty()) {
            throw ValidationException::withMessages([
                'period' => 'No active employees with a salary were found.',
            ]);
        }

        $year = (int) substr($period, 0, 4);

        return DB::transaction(function () use ($period, $creator, $employees, $year) {
            $run = PayrollRun::create([
                'period' => $period,
                'status' => 'draft',
                'created_by' => $creator->id,
            ]);

            $grossTotal = 0;
            $netTotal = 0;

            foreach ($employees as $employee) {
                $item = $this->buildItem($run, $employee, $year);
                $grossTotal += (float) $item->gross;
                $netTotal += (float) $item->net;
            }

            $run->update(['gross_total' => $grossTotal, 'net_total' => $netTotal]);
            AuditLog::record('payroll.drafted', $run);

            return $run->fresh('items');
        });
    }

    public function approve(PayrollRun $run, User $approver): PayrollRun
    {
        $this->assertStatus($run, 'draft');

        $run->update([
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('payroll.approved', $run);

        return $run->refresh();
    }

    public function publish(PayrollRun $run): PayrollRun
    {
        $this->assertStatus($run, 'approved');

        $run->update(['status' => 'published', 'published_at' => now()]);
        AuditLog::record('payroll.published', $run);

        // Payslip PDFs render on the reports queue, one job per employee.
        foreach ($run->items()->pluck('id') as $itemId) {
            GeneratePayslipPdf::dispatch($itemId);
        }

        return $run->refresh();
    }

    /**
     * Adjust a draft run item with one-off bonuses and deductions, then
     * recompute its taxes and the run totals. Bonuses are taxable but not
     * pensionable; deductions (loans, advances) come off after tax.
     *
     * @param array<string, float> $bonuses
     * @param array<string, float> $deductions
     */
    public function adjustItem(PayrollRun $run, PayrollItem $item, array $bonuses, array $deductions): PayrollItem
    {
        $this->assertStatus($run, 'draft');

        if ($item->payroll_run_id !== $run->id) {
            throw ValidationException::withMessages(['item' => 'This item does not belong to the run.']);
        }

        $year = (int) substr($run->period, 0, 4);

        $basic = (float) $item->basic;
        $allowances = collect($item->allowances ?? [])->map(fn ($v) => (float) $v);
        $bonusTotal = collect($bonuses)->sum();
        $deductionTotal = collect($deductions)->sum();

        $grossMonthly = $basic + $allowances->sum() + $bonusTotal;
        $pensionMonthly = $this->pensionEmployee($basic, $allowances->all());
        $payeMonthly = $this->payeMonthly($grossMonthly, $pensionMonthly, $year);
        $net = $grossMonthly - $pensionMonthly - $payeMonthly - $deductionTotal;

        $item->update([
            'bonuses' => $bonuses ?: null,
            'deductions' => $deductions ?: null,
            'gross' => round($grossMonthly, 2),
            'paye_tax' => round($payeMonthly, 2),
            'net' => round($net, 2),
        ]);

        $run->update([
            'gross_total' => (float) $run->items()->sum('gross'),
            'net_total' => (float) $run->items()->sum('net'),
        ]);

        AuditLog::record('payroll.item_adjusted', $item);

        return $item->refresh();
    }

    /** Monthly figures for one employee, persisted as a run item. */
    private function buildItem(PayrollRun $run, Employee $employee, int $year): PayrollItem
    {
        $basic = (float) $employee->base_salary;
        $allowances = collect($employee->allowances ?? [])
            ->map(fn ($v) => (float) $v)
            ->filter(fn ($v) => $v > 0);

        $grossMonthly = $basic + $allowances->sum();
        $pensionMonthly = $this->pensionEmployee($basic, $allowances->all());
        $payeMonthly = $this->payeMonthly($grossMonthly, $pensionMonthly, $year);

        $net = $grossMonthly - $pensionMonthly - $payeMonthly;

        return PayrollItem::create([
            'payroll_run_id' => $run->id,
            'employee_id' => $employee->id,
            'basic' => $basic,
            'allowances' => $allowances->all() ?: null,
            'gross' => round($grossMonthly, 2),
            'pension_employee' => round($pensionMonthly, 2),
            'pension_employer' => round($this->pensionablePay($basic, $allowances->all()) * config('payroll.pension.employer_rate'), 2),
            'paye_tax' => round($payeMonthly, 2),
            'net' => round($net, 2),
        ]);
    }

    /** Pensionable pay: basic + itemized housing/transport allowances. */
    public function pensionablePay(float $basic, array $allowances): float
    {
        $keys = config('payroll.pension.pensionable_allowances', []);
        $extra = collect($allowances)->only($keys)->sum();

        return $basic + (float) $extra;
    }

    public function pensionEmployee(float $basic, array $allowances): float
    {
        return $this->pensionablePay($basic, $allowances) * (float) config('payroll.pension.employee_rate');
    }

    /**
     * Monthly PAYE: annualize, deduct reliefs (pension; CRA on legacy
     * tables), run the progressive bands, divide by 12.
     */
    public function payeMonthly(float $grossMonthly, float $pensionMonthly, int $year): float
    {
        $table = $this->tableFor($year);

        $annualGross = $grossMonthly * 12;
        $annualTaxable = $annualGross - ($pensionMonthly * 12);

        if ($table['consolidated_relief'] ?? false) {
            $cra = max(200_000, $annualGross * 0.01) + $annualGross * 0.20;
            $annualTaxable -= $cra;
        }

        return $this->progressiveTax(max(0, $annualTaxable), $table['bands']) / 12;
    }

    /** @param array<array{0: int|float, 1: float}> $bands [ceiling, rate], ceilings cumulative */
    public function progressiveTax(float $taxable, array $bands): float
    {
        $tax = 0.0;
        $previousCeiling = 0;

        foreach ($bands as [$ceiling, $rate]) {
            if ($taxable <= $previousCeiling) {
                break;
            }
            $sliceTop = min($taxable, (float) $ceiling);
            $tax += ($sliceTop - $previousCeiling) * $rate;
            $previousCeiling = (float) $ceiling;
        }

        return $tax;
    }

    /** Latest tax table whose year is <= the run year. */
    private function tableFor(int $year): array
    {
        $tables = config('payroll.paye_tables');
        $applicable = collect($tables)
            ->keys()
            ->filter(fn (int $tableYear) => $tableYear <= $year)
            ->max();

        return $tables[$applicable ?? array_key_first($tables)];
    }

    private function assertStatus(PayrollRun $run, string $expected): void
    {
        if ($run->status !== $expected) {
            throw ValidationException::withMessages([
                'status' => "This run is {$run->status}; expected {$expected}.",
            ]);
        }
    }
}
