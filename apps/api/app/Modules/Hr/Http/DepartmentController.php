<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DepartmentController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->requirePermission('hr.departments.view');

        return $this->respond(
            Department::query()
                ->withCount('employees')
                ->orderBy('name')
                ->get()
                ->map(fn (Department $d) => $this->present($d)),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        $data = $request->validate($this->rules($request));

        $department = Department::create($data);
        AuditLog::record('hr.department_created', $department, ['name' => $department->name]);

        return $this->respond($this->present($department->loadCount('employees')), 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        $data = $request->validate($this->rules($request, $department));
        $department->update($data);

        return $this->respond($this->present($department->fresh()->loadCount('employees')));
    }

    public function destroy(Department $department): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        // Deleting would silently orphan people — make the caller move them first.
        $staff = Employee::query()->where('department_id', $department->id)->count();
        if ($staff > 0) {
            return $this->respondError(
                'VALIDATION',
                "Move the {$staff} employee".($staff === 1 ? '' : 's')." in this department first.",
                422,
            );
        }

        AuditLog::record('hr.department_deleted', $department, ['name' => $department->name]);
        $department->delete();

        return $this->respond(null, 204);
    }

    /** Names are unique per tenant — validate so duplicates return 422, not a DB error. */
    private function rules(Request $request, ?Department $department = null): array
    {
        $sometimes = $department ? 'sometimes' : 'required';

        return [
            'name' => [
                $sometimes, 'string', 'max:120',
                Rule::unique('departments', 'name')
                    ->where('tenant_id', $request->user()->tenant_id)
                    ->whereNull('deleted_at')
                    ->ignore($department?->id),
            ],
            'code' => [$department ? 'sometimes' : 'nullable', 'nullable', 'string', 'max:20'],
            'manager_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
        ];
    }

    private function present(Department $d): array
    {
        $manager = $d->manager_id
            ? Employee::query()->find($d->manager_id)
            : null;

        return [
            'id' => $d->id,
            'name' => $d->name,
            'code' => $d->code,
            'manager_id' => $d->manager_id,
            'manager' => $manager ? "{$manager->first_name} {$manager->last_name}" : null,
            'employees_count' => $d->employees_count ?? 0,
        ];
    }
}
