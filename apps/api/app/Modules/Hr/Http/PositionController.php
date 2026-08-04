<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\Position;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PositionController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->requirePermission('hr.departments.view');

        return $this->respond(
            Position::query()
                ->with('department:id,name')
                ->withCount('employees')
                ->orderBy('title')
                ->get()
                ->map(fn (Position $p) => $this->present($p)),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        $data = $request->validate($this->rules($request));

        $position = Position::create($data);
        AuditLog::record('hr.position_created', $position, ['title' => $position->title]);

        return $this->respond($this->present($position->load('department:id,name')->loadCount('employees')), 201);
    }

    public function update(Request $request, Position $position): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        $data = $request->validate($this->rules($request, $position));
        $position->update($data);

        return $this->respond($this->present(
            $position->fresh(['department:id,name'])->loadCount('employees'),
        ));
    }

    public function destroy(Position $position): JsonResponse
    {
        $this->requirePermission('hr.departments.manage');

        $held = Employee::query()->where('position_id', $position->id)->count();
        if ($held > 0) {
            return $this->respondError(
                'VALIDATION',
                "Reassign the {$held} employee".($held === 1 ? '' : 's')." holding this position first.",
                422,
            );
        }

        AuditLog::record('hr.position_deleted', $position, ['title' => $position->title]);
        $position->delete();

        return $this->respond(null, 204);
    }

    /** Titles are unique per tenant. */
    private function rules(Request $request, ?Position $position = null): array
    {
        return [
            'title' => [
                $position ? 'sometimes' : 'required', 'string', 'max:120',
                Rule::unique('positions', 'title')
                    ->where('tenant_id', $request->user()->tenant_id)
                    ->ignore($position?->id),
            ],
            'level' => [$position ? 'sometimes' : 'nullable', 'nullable', 'string', 'max:40'],
            'department_id' => ['sometimes', 'nullable', 'integer', 'exists:departments,id'],
        ];
    }

    private function present(Position $p): array
    {
        return [
            'id' => $p->id,
            'title' => $p->title,
            'level' => $p->level,
            'department_id' => $p->department_id,
            'department' => $p->department?->name,
            'employees_count' => $p->employees_count ?? 0,
        ];
    }
}
