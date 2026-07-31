<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\KeyResult;
use App\Models\Objective;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PerformanceController extends ApiController
{
    /**
     * Own objectives always; everyone's with hr.performance.view.
     * ?scope=team returns all (viewers only), default is mine.
     */
    public function index(Request $request): JsonResponse
    {
        $canViewAll = Gate::allows('permission', ['hr.performance.view']);
        $scope = $request->query('scope', 'mine');
        $myEmployeeId = $request->user()->employee?->id;

        if ($scope === 'team' && ! $canViewAll) {
            return $this->respondError('FORBIDDEN', 'You cannot view team objectives.', 403);
        }

        $objectives = Objective::query()
            ->with(['employee:id,first_name,last_name', 'keyResults'])
            ->when($scope !== 'team', fn ($q) => $q->where('employee_id', $myEmployeeId ?? -1))
            ->when($request->query('filter.period'), fn ($q, $p) => $q->where('period', $p))
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (Objective $o) => $this->present($o));

        return $this->respond($objectives, meta: [
            'can_view_all' => $canViewAll,
            'can_manage' => Gate::allows('permission', ['hr.performance.manage']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:4000'],
            'period' => ['required', 'string', 'max:12'],
            'employee_id' => ['nullable', 'integer'],
            'key_results' => ['required', 'array', 'min:1', 'max:10'],
            'key_results.*.title' => ['required', 'string', 'max:200'],
            'key_results.*.target_value' => ['required', 'numeric', 'gt:0'],
            'key_results.*.unit' => ['nullable', 'string', 'max:20'],
        ]);

        $user = $request->user();
        $ownEmployeeId = $user->employee?->id;
        $employeeId = $data['employee_id'] ?? $ownEmployeeId;

        if ($employeeId === null) {
            return $this->respondError('VALIDATION', 'Your account has no employee record to attach objectives to.', 422);
        }

        // Creating for someone else requires manage.
        if ($employeeId !== $ownEmployeeId) {
            $this->requirePermission('hr.performance.manage');
            if (! Employee::query()->whereKey($employeeId)->exists()) {
                return $this->respondError('VALIDATION', 'Employee not found.', 422);
            }
        }

        $objective = Objective::create([
            ...collect($data)->except(['key_results', 'employee_id'])->all(),
            'employee_id' => $employeeId,
            'created_by' => $user->id,
        ]);

        foreach ($data['key_results'] as $kr) {
            $objective->keyResults()->make($kr)->save();
        }

        AuditLog::record('hr.objective_created', $objective, ['title' => $objective->title]);

        return $this->respond($this->present($objective->load(['employee:id,first_name,last_name', 'keyResults'])), 201);
    }

    public function update(Request $request, Objective $objective): JsonResponse
    {
        $this->authorizeOwnerOrManager($request, $objective);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'status' => ['sometimes', 'in:'.implode(',', Objective::STATUSES)],
        ]);

        $objective->update($data);

        return $this->respond($this->present($objective->fresh(['employee:id,first_name,last_name', 'keyResults'])));
    }

    /** Progress check-in on a key result. */
    public function updateKeyResult(Request $request, KeyResult $keyResult): JsonResponse
    {
        $this->authorizeOwnerOrManager($request, $keyResult->objective);

        $data = $request->validate([
            'current_value' => ['required', 'numeric', 'min:0'],
        ]);

        $keyResult->update($data);

        return $this->respond($this->present($keyResult->objective->fresh(['employee:id,first_name,last_name', 'keyResults'])));
    }

    public function destroy(Request $request, Objective $objective): JsonResponse
    {
        $this->authorizeOwnerOrManager($request, $objective);

        AuditLog::record('hr.objective_deleted', $objective, ['title' => $objective->title]);
        $objective->delete();

        return $this->respond(null, 204);
    }

    private function authorizeOwnerOrManager(Request $request, Objective $objective): void
    {
        $ownEmployeeId = $request->user()->employee?->id;
        if ($objective->employee_id !== $ownEmployeeId
            && ! Gate::allows('permission', ['hr.performance.manage'])) {
            abort(403, 'Only the owner or a performance manager can change this objective.');
        }
    }

    private function present(Objective $objective): array
    {
        return [
            'id' => $objective->id,
            'title' => $objective->title,
            'description' => $objective->description,
            'period' => $objective->period,
            'status' => $objective->status,
            'employee' => $objective->employee
                ? "{$objective->employee->first_name} {$objective->employee->last_name}"
                : null,
            'employee_id' => $objective->employee_id,
            'progress' => $objective->progress(),
            'key_results' => $objective->keyResults->map(fn (KeyResult $kr) => [
                'id' => $kr->id,
                'title' => $kr->title,
                'target_value' => (float) $kr->target_value,
                'current_value' => (float) $kr->current_value,
                'unit' => $kr->unit,
                'completion' => $kr->completion(),
            ])->values(),
            'created_at' => $objective->created_at->toIso8601String(),
        ];
    }
}
