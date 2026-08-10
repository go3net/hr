<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Core\Tenancy\TenantContext;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\WorkSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Resumption and closing hours. Attendance decides who is late from these, so
 * without a schedule assigned nobody is ever marked late — the table existed
 * but nothing in the product could create or edit one.
 */
class WorkScheduleController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->requirePermission('hr.attendance.view');

        return $this->respond(
            WorkSchedule::query()->withCount('employees')->orderBy('name')->get()
                ->map(fn (WorkSchedule $s) => $this->present($s)),
        );
    }

    public function store(Request $request): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $schedule = WorkSchedule::create(
            $this->validated($request) + ['tenant_id' => app(TenantContext::class)->id()],
        );

        AuditLog::record('work_schedule.created', $schedule);

        return $this->respond($this->present($schedule->loadCount('employees')), 201);
    }

    public function update(Request $request, WorkSchedule $workSchedule): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        $workSchedule->update($this->validated($request, $workSchedule->id));
        AuditLog::record('work_schedule.updated', $workSchedule);

        return $this->respond($this->present($workSchedule->fresh()->loadCount('employees')));
    }

    public function destroy(WorkSchedule $workSchedule): JsonResponse
    {
        $this->requirePermission('hr.employees.manage');

        // Employees still on it would silently stop being marked late.
        abort_if(
            $workSchedule->employees()->exists(),
            422,
            'Staff are still on this schedule — move them to another one first.',
        );

        $workSchedule->delete();

        return $this->respond(['deleted' => true]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:80',
                Rule::unique('work_schedules', 'name')
                    ->where('tenant_id', app(TenantContext::class)->id())
                    ->ignore($ignoreId),
            ],
            'starts_at' => ['required', 'date_format:H:i'],
            'ends_at' => ['required', 'date_format:H:i', 'after:starts_at'],
            'grace_minutes' => ['required', 'integer', 'min:0', 'max:240'],
            'work_days' => ['required', 'array', 'min:1'],
            'work_days.*' => ['integer', 'between:1,7'],
        ], [
            'ends_at.after' => 'Closing time must be after the resumption time.',
            'work_days.min' => 'Pick at least one working day.',
        ]);

        $data['work_days'] = array_values(array_unique($data['work_days']));
        sort($data['work_days']);

        return $data;
    }

    private function present(WorkSchedule $s): array
    {
        return [
            'id' => $s->id,
            // Times come back as H:i so a <input type="time"> can round-trip them.
            'starts_at' => substr((string) $s->starts_at, 0, 5),
            'ends_at' => substr((string) $s->ends_at, 0, 5),
            'name' => $s->name,
            'grace_minutes' => $s->grace_minutes,
            'work_days' => $s->work_days ?? [1, 2, 3, 4, 5],
            'employees_count' => (int) ($s->employees_count ?? 0),
        ];
    }

    /** Staff with no schedule are never flagged late — worth surfacing. */
    public function unassignedCount(): JsonResponse
    {
        $this->requirePermission('hr.attendance.view');

        return $this->respond([
            'unassigned' => Employee::query()
                ->where('status', '!=', 'exited')
                ->whereNull('work_schedule_id')
                ->count(),
        ]);
    }
}
