<?php

namespace App\Modules\Dashboard\Http;

use App\Core\Http\ApiController;
use App\Models\AttendanceRecord;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class DashboardController extends ApiController
{
    public function summary(): JsonResponse
    {
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

        return $this->respond($summary);
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
