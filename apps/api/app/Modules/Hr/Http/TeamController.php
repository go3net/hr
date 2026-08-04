<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Modules\Hr\Services\ProfileCompleteness;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * "My team" for managers and team leads: the people who report to them,
 * with today's attendance, who is away, and what needs a decision.
 */
class TeamController extends ApiController
{
    public function __construct(private readonly ProfileCompleteness $completeness)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission('hr.team.view');

        $manager = Employee::query()->where('user_id', $request->user()->id)->first();
        // HR/CEO see everyone; a lead without an employee record has no team.
        $seesEveryone = Gate::allows('permission', ['hr.employees.view']) && $request->boolean('all');

        if (! $manager && ! $seesEveryone) {
            return $this->respond([], meta: [
                'has_employee_record' => false,
                'team_size' => 0,
                'present_today' => 0,
                'on_leave_today' => 0,
                'pending_leave' => 0,
            ]);
        }

        $reports = Employee::query()
            ->with(['department:id,name', 'position:id,title', 'user:id,status'])
            ->when(! $seesEveryone, fn ($q) => $q->where('manager_id', $manager->id))
            ->where('status', '!=', 'exited')
            ->orderBy('first_name')
            ->get();

        $today = now()->toDateString();
        $ids = $reports->pluck('id');

        $attendance = AttendanceRecord::query()
            ->whereIn('employee_id', $ids)
            ->whereDate('work_date', $today)
            ->get()
            ->keyBy('employee_id');

        $onLeave = LeaveRequest::query()
            ->whereIn('employee_id', $ids)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $today)
            ->whereDate('end_date', '>=', $today)
            ->get()
            ->keyBy('employee_id');

        $pending = LeaveRequest::query()
            ->whereIn('employee_id', $ids)
            ->where('status', 'pending')
            ->count();

        $team = $reports->map(function (Employee $e) use ($attendance, $onLeave) {
            $record = $attendance->get($e->id);

            return [
                'id' => $e->public_id,
                'employee_id' => $e->id,
                'name' => $e->full_name,
                'employee_code' => $e->employee_code,
                'email' => $e->email,
                'department' => $e->department?->name,
                'position' => $e->position?->title,
                'status' => $e->status,
                'account_status' => $e->user?->status,
                'today' => $onLeave->has($e->id)
                    ? 'on_leave'
                    : ($record ? ($record->is_late ? 'late' : 'present') : 'absent'),
                'clocked_in_at' => $record?->clocked_in_at?->toIso8601String(),
                'profile_percent' => $this->completeness->for($e)['percent'],
            ];
        });

        return $this->respond($team, meta: [
            'has_employee_record' => $manager !== null,
            'scope' => $seesEveryone ? 'all' : 'direct_reports',
            'team_size' => $team->count(),
            'present_today' => $team->whereIn('today', ['present', 'late'])->count(),
            'on_leave_today' => $team->where('today', 'on_leave')->count(),
            'pending_leave' => $pending,
            'can_approve_leave' => Gate::allows('permission', ['hr.leave.approve']),
        ]);
    }
}
