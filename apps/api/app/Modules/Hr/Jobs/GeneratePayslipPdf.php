<?php

namespace App\Modules\Hr\Jobs;

use App\Models\PayrollItem;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;

class GeneratePayslipPdf implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly int $payrollItemId)
    {
        $this->onQueue('reports');
    }

    public function handle(): void
    {
        $item = PayrollItem::query()
            ->withoutGlobalScopes()
            ->with(['run', 'employee.department'])
            ->find($this->payrollItemId);

        if (! $item || ! $item->run || ! $item->employee) {
            return;
        }

        $deductions = collect($item->deductions ?? []);

        $pdf = Pdf::loadView('payslips.payslip', [
            'tenantName' => $item->run->tenant?->name ?? 'Go3net Office',
            'period' => $item->run->period,
            'publishedAt' => $item->run->published_at?->toDateString() ?? now()->toDateString(),
            'employeeName' => $item->employee->full_name,
            'employeeCode' => $item->employee->employee_code,
            'department' => $item->employee->department?->name,
            'basic' => (float) $item->basic,
            'allowances' => $item->allowances ?? [],
            'bonuses' => $item->bonuses ?? [],
            'deductions' => $deductions->all(),
            'gross' => (float) $item->gross,
            'pension' => (float) $item->pension_employee,
            'paye' => (float) $item->paye_tax,
            'totalDeductions' => (float) $item->pension_employee + (float) $item->paye_tax + $deductions->sum(),
            'net' => (float) $item->net,
        ]);

        $path = "tenants/{$item->tenant_id}/payslips/{$item->run->period}/{$item->employee->employee_code}.pdf";
        Storage::put($path, $pdf->output());

        $item->update(['payslip_path' => $path]);
    }
}
