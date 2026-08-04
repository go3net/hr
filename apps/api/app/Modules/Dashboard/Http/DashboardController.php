<?php

namespace App\Modules\Dashboard\Http;

use App\Core\Http\ApiController;
use App\Models\AttendanceRecord;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class DashboardController extends ApiController
{
    /**
     * Company-wide headcount, attendance and leave figures are management
     * information. Staff without people-visibility get a dashboard about
     * themselves instead of a 403 — the page still works, it is just theirs.
     */
    private function seesCompanyWide(): bool
    {
        return \Illuminate\Support\Facades\Gate::allows('permission', 'hr.employees.view');
    }

    public function summary(Request $request): JsonResponse
    {
        if (! $this->seesCompanyWide()) {
            return $this->respond($this->personalSummary($request), 200, ['scope' => 'personal']);
        }

        $tenantId = app(\App\Core\Tenancy\TenantContext::class)->id();

        // Aggregates are cheap but hot — cache per tenant for one minute.
        $summary = Cache::remember("t{$tenantId}:dashboard:summary", 60, function () {
            $today = now()->toDateString();
            $activeStaff = Employee::query()->where('status', '!=', 'exited')->count();
            $todayRecords = AttendanceRecord::query()->whereDate('work_date', $today)->get(['is_late']);

            return [
                'total_staff' => $activeStaff,
                'new_this_month' => Employee::query()
                    ->whereDate('hired_at', '>=', now()->startOfMonth()->toDateString())
                    ->count(),
                'departments' => Department::query()->count(),
                'attendance_today' => [
                    'present' => $todayRecords->count(),
                    'late' => $todayRecords->where('is_late', true)->count(),
                    'absent' => max(0, $activeStaff - $todayRecords->count()),
                ],
                'pending_leave' => LeaveRequest::query()->where('status', 'pending')->count(),
                'birthdays_this_month' => Employee::query()
                    ->whereNotNull('date_of_birth')
                    ->whereMonth('date_of_birth', now()->month)
                    ->count(),
            ];
        });

        return $this->respond($summary, 200, ['scope' => 'company']);
    }

    /** What the signed-in member sees when they cannot view company figures. */
    private function personalSummary(Request $request): array
    {
        $employee = $request->user()->employee;

        if (! $employee) {
            return [
                'has_employee_record' => false,
                'clocked_in' => false,
                'clocked_in_at' => null,
                'leave_pending' => 0,
                'leave_taken_this_year' => 0,
                'profile_percent' => 0,
                'open_tasks' => 0,
            ];
        }

        $today = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('work_date', now()->toDateString())
            ->first();

        $leave = LeaveRequest::query()->where('employee_id', $employee->id);

        return [
            'has_employee_record' => true,
            'clocked_in' => (bool) $today?->clocked_in_at && ! $today?->clocked_out_at,
            'clocked_in_at' => $today?->clocked_in_at?->toIso8601String(),
            'is_late_today' => (bool) $today?->is_late,
            'leave_pending' => (clone $leave)->where('status', 'pending')->count(),
            'leave_taken_this_year' => (clone $leave)
                ->where('status', 'approved')
                ->whereYear('start_date', now()->year)
                ->sum('days'),
            'profile_percent' => app(\App\Modules\Hr\Services\ProfileCompleteness::class)->for($employee)['percent'],
            // Tasks are assigned through the task_assignees pivot, not a column.
            'open_tasks' => \App\Models\Task::query()
                ->whereHas('assignees', fn ($q) => $q->where('users.id', $request->user()->id))
                ->where('status', '!=', 'done')
                ->count(),
        ];
    }

    /** Series for the executive charts: attendance trend + department headcount. */
    public function charts(): JsonResponse
    {
        // Headcount by department and company attendance rates are the same
        // management information as the summary above.
        if (! $this->seesCompanyWide()) {
            return $this->respond(
                ['attendance' => [], 'headcount' => [], 'active_staff' => 0],
                200,
                ['scope' => 'personal'],
            );
        }

        $tenantId = app(\App\Core\Tenancy\TenantContext::class)->id();

        $charts = Cache::remember("t{$tenantId}:dashboard:charts", 300, function () {
            $activeStaff = Employee::query()->where('status', 'active')->count();

            // Last 10 working days (Mon–Fri), oldest first.
            $days = collect();
            $cursor = now()->startOfDay();
            while ($days->count() < 10) {
                if ($cursor->isWeekday()) {
                    $days->prepend($cursor->copy());
                }
                $cursor->subDay();
            }

            $records = AttendanceRecord::query()
                ->whereDate('work_date', '>=', $days->first()->toDateString())
                ->get(['work_date', 'is_late'])
                ->groupBy(fn (AttendanceRecord $r) => $r->work_date->toDateString());

            $attendance = $days->map(function ($day) use ($records, $activeStaff) {
                $present = $records->get($day->toDateString())?->count() ?? 0;

                return [
                    'day' => $day->format('D j'),
                    'rate' => $activeStaff > 0 ? (int) round($present / $activeStaff * 100) : 0,
                    'present' => $present,
                ];
            })->values();

            $headcount = Department::query()
                ->withCount(['employees' => fn ($q) => $q->where('status', 'active')])
                ->orderByDesc('employees_count')
                ->limit(8)
                ->get()
                ->map(fn (Department $d) => [
                    'department' => $d->name,
                    'count' => $d->employees_count,
                ])
                ->values();

            return ['attendance' => $attendance, 'headcount' => $headcount, 'active_staff' => $activeStaff];
        });

        return $this->respond($charts, 200, ['scope' => 'company']);
    }

    public function activity(): JsonResponse
    {
        $this->requirePermission('dashboard.activity.view');

        return $this->respond(
            AuditLog::query()
                ->where('tenant_id', app(\App\Core\Tenancy\TenantContext::class)->id())
                ->with('user:id,name')
                ->latest('created_at')
                ->limit(25)
                ->get()
                ->map(fn (AuditLog $log) => [
                    'id' => $log->id,
                    'actor' => $log->user?->name,
                    'action' => $log->action,
                    'entity_type' => $log->entity_type ? class_basename($log->entity_type) : null,
                    'entity_id' => $log->entity_id,
                    'at' => $log->created_at->toIso8601String(),
                ]),
        );
    }
}
