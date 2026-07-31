<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Modules\Hr\Services\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollController extends ApiController
{
    public function __construct(private readonly PayrollService $payroll)
    {
    }

    public function index(): JsonResponse
    {
        $this->requirePermission('hr.payroll.view');

        return $this->respond(
            PayrollRun::query()
                ->withCount('items')
                ->orderByDesc('period')
                ->limit(24)
                ->get()
                ->map(fn (PayrollRun $run) => $this->presentRun($run)),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('hr.payroll.manage');

        $data = $request->validate([
            'period' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
        ]);

        $run = $this->payroll->createRun($data['period'], $request->user());

        return $this->respond($this->presentRun($run->loadCount('items')), 201);
    }

    public function show(PayrollRun $payrollRun): JsonResponse
    {
        $this->requirePermission('hr.payroll.view');

        $payrollRun->load(['items.employee:id,first_name,last_name,employee_code'])->loadCount('items');

        return $this->respond($this->presentRun($payrollRun) + [
            'items' => $payrollRun->items->map(fn (PayrollItem $item) => $this->presentItem($item)),
        ]);
    }

    public function approve(Request $request, PayrollRun $payrollRun): JsonResponse
    {
        $this->requirePermission('hr.payroll.manage');

        return $this->respond($this->presentRun($this->payroll->approve($payrollRun, $request->user())->loadCount('items')));
    }

    public function publish(PayrollRun $payrollRun): JsonResponse
    {
        $this->requirePermission('hr.payroll.manage');

        return $this->respond($this->presentRun($this->payroll->publish($payrollRun)->loadCount('items')));
    }

    /** Rows for a bank transfer file (published runs only). */
    public function bankExport(PayrollRun $payrollRun): JsonResponse
    {
        $this->requirePermission('hr.payroll.manage');

        if ($payrollRun->status !== 'published') {
            return $this->respondError('RUN_NOT_PUBLISHED', 'Publish the run before exporting.', 422);
        }

        $payrollRun->load('items.employee');

        return $this->respond(
            $payrollRun->items->map(fn (PayrollItem $item) => [
                'employee_code' => $item->employee->employee_code,
                'employee' => $item->employee->full_name,
                'bank_name' => $item->employee->bank_name,
                'account_number' => $item->employee->bank_account_number,
                'amount' => (float) $item->net,
                'narration' => "Salary {$payrollRun->period}",
            ]),
        );
    }

    /** The signed-in employee's own published payslips. */
    public function myPayslips(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;
        abort_if(! $employee, 422, 'No employee profile is linked to your account.');

        return $this->respond(
            PayrollItem::query()
                ->where('employee_id', $employee->id)
                ->whereHas('run', fn ($q) => $q->where('status', 'published'))
                ->with('run:id,period,published_at')
                ->orderByDesc('id')
                ->limit(24)
                ->get()
                ->map(fn (PayrollItem $item) => $this->presentItem($item) + [
                    'period' => $item->run->period,
                    'published_at' => $item->run->published_at?->toDateString(),
                ]),
        );
    }

    private function presentRun(PayrollRun $run): array
    {
        return [
            'id' => $run->id,
            'period' => $run->period,
            'status' => $run->status,
            'employees' => $run->items_count ?? null,
            'gross_total' => (float) $run->gross_total,
            'net_total' => (float) $run->net_total,
            'approved_at' => $run->approved_at?->toIso8601String(),
            'published_at' => $run->published_at?->toIso8601String(),
            'created_at' => $run->created_at->toIso8601String(),
        ];
    }

    private function presentItem(PayrollItem $item): array
    {
        return [
            'id' => $item->id,
            'employee' => $item->relationLoaded('employee') ? $item->employee?->full_name : null,
            'employee_code' => $item->relationLoaded('employee') ? $item->employee?->employee_code : null,
            'basic' => (float) $item->basic,
            'allowances' => $item->allowances,
            'gross' => (float) $item->gross,
            'pension_employee' => (float) $item->pension_employee,
            'paye_tax' => (float) $item->paye_tax,
            'net' => (float) $item->net,
        ];
    }
}
