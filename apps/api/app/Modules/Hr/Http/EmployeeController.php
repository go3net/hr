<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends ApiController
{
    private const SENSITIVE_FIELDS = ['nin', 'bvn', 'bank_name', 'bank_account_number', 'pension_pin', 'medical_notes'];

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission('hr.employees.view');

        $employees = Employee::query()
            ->with(['department:id,name', 'position:id,title', 'user:id,status'])
            ->when($request->query('q'), function ($query, $q) {
                $query->where(fn ($w) => $w
                    ->where('first_name', 'like', "%{$q}%")
                    ->orWhere('last_name', 'like', "%{$q}%")
                    ->orWhere('employee_code', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%"));
            })
            ->when($request->query('filter.status'), fn ($query, $s) => $query->where('status', $s))
            ->when($request->query('filter.department_id'), fn ($query, $d) => $query->where('department_id', $d))
            ->orderBy('first_name')
            ->cursorPaginate(min((int) $request->query('per_page', 25), 100));

        $items = collect($employees->items())->map(fn (Employee $e) => $this->presentSummary($e));

        return $this->respond($items, 200, [
            'pagination' => [
                'next_cursor' => $employees->nextCursor()?->encode(),
                'per_page' => $employees->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $data = $request->validate([
            'employee_code' => ['required', 'string', 'max:40'],
            'first_name' => ['required', 'string', 'max:80'],
            'last_name' => ['required', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40'],
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:255'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'position_id' => ['nullable', 'integer', 'exists:positions,id'],
            'manager_id' => ['nullable', 'integer', 'exists:employees,id'],
            'work_schedule_id' => ['nullable', 'integer', 'exists:work_schedules,id'],
            'employment_type' => ['nullable', 'in:full_time,contract,nysc,intern'],
            'hired_at' => ['nullable', 'date'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'nin' => ['nullable', 'string', 'max:20'],
            'bvn' => ['nullable', 'string', 'max:20'],
            'bank_name' => ['nullable', 'string', 'max:80'],
            'bank_account_number' => ['nullable', 'string', 'max:20'],
            'invite' => ['sometimes', 'boolean'],
        ]);

        $invite = (bool) ($data['invite'] ?? false);
        unset($data['invite']);

        $employee = Employee::create($data);
        AuditLog::record('employee.created', $employee);

        if ($invite && $employee->email) {
            app(\App\Modules\Hr\Services\InvitationService::class)->invite($employee, $request->user());
        }

        return $this->respond($this->present($employee->fresh(['department', 'position'])), 201);
    }

    /** Send (or re-send) the account setup invitation email. */
    public function sendInvite(Request $request, Employee $employee): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $user = app(\App\Modules\Hr\Services\InvitationService::class)
            ->invite($employee, $request->user());

        return $this->respond(['invited' => true, 'email' => $user->email]);
    }

    public function show(Request $request, Employee $employee): JsonResponse
    {
        $this->requirePermission('hr.employees.view');

        $employee->load(['department', 'position', 'manager:id,first_name,last_name', 'emergencyContacts', 'guarantors', 'employmentEvents']);

        return $this->respond($this->present(
            $employee,
            withSensitive: $request->user()->hasPermission('hr.employees.view_sensitive'),
        ));
    }

    public function update(Request $request, Employee $employee): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $data = $request->validate([
            'first_name' => ['sometimes', 'string', 'max:80'],
            'last_name' => ['sometimes', 'string', 'max:80'],
            'email' => ['sometimes', 'nullable', 'email', 'max:190'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:40'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
            'position_id' => ['sometimes', 'nullable', 'integer', 'exists:positions,id'],
            'manager_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
            'work_schedule_id' => ['sometimes', 'nullable', 'integer', 'exists:work_schedules,id'],
            'employment_type' => ['sometimes', 'in:full_time,contract,nysc,intern'],
            'status' => ['sometimes', 'in:active,on_leave,suspended,exited'],
            'base_salary' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ]);

        $before = $employee->only(array_keys($data));
        $employee->update($data);
        AuditLog::record('employee.updated', $employee, ['before' => $before, 'after' => $data]);

        return $this->respond($this->present($employee->fresh(['department', 'position'])));
    }

    public function destroy(Employee $employee): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $employee->delete();
        AuditLog::record('employee.deleted', $employee);

        return $this->respond(null, 204);
    }

    private function presentSummary(Employee $e): array
    {
        return [
            'id' => $e->public_id,
            'employee_id' => $e->id, // internal id for pickers (assets, objectives)
            'employee_code' => $e->employee_code,
            'account_status' => $e->user?->status, // null | invited | active | disabled
            'name' => $e->full_name,
            'email' => $e->email,
            'department' => $e->department?->name,
            'position' => $e->position?->title,
            'employment_type' => $e->employment_type,
            'status' => $e->status,
            'hired_at' => $e->hired_at?->toDateString(),
        ];
    }

    private function present(Employee $e, bool $withSensitive = false): array
    {
        $base = $this->presentSummary($e) + [
            'phone' => $e->phone,
            'date_of_birth' => $e->date_of_birth?->toDateString(),
            'gender' => $e->gender,
            'address' => $e->address,
            'manager' => $e->manager?->full_name,
            'emergency_contacts' => $e->relationLoaded('emergencyContacts') ? $e->emergencyContacts : null,
            'guarantors' => $e->relationLoaded('guarantors') ? $e->guarantors : null,
            'history' => $e->relationLoaded('employmentEvents') ? $e->employmentEvents : null,
        ];

        if ($withSensitive) {
            $base += $e->only(self::SENSITIVE_FIELDS) + ['base_salary' => $e->base_salary];
        }

        return $base;
    }
}
