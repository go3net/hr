<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\Department;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
                ->map(fn (Department $d) => [
                    'id' => $d->id,
                    'name' => $d->name,
                    'code' => $d->code,
                    'employees_count' => $d->employees_count,
                ]),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:20'],
            'manager_id' => ['nullable', 'integer', 'exists:employees,id'],
        ]);

        return $this->respond(Department::create($data), 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'code' => ['sometimes', 'nullable', 'string', 'max:20'],
            'manager_id' => ['sometimes', 'nullable', 'integer', 'exists:employees,id'],
        ]);

        $department->update($data);

        return $this->respond($department);
    }

    public function destroy(Department $department): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        $department->delete();

        return $this->respond(null, 204);
    }
}
