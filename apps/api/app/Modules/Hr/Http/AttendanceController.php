<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\AttendanceRecord;
use App\Modules\Hr\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceController extends ApiController
{
    public function __construct(private readonly AttendanceService $attendance)
    {
    }

    public function clockIn(Request $request): JsonResponse
    {
        $data = $request->validate([
            'method' => ['required', 'in:gps,qr,web'],
            'latitude' => ['required_if:method,gps', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['required_if:method,gps', 'nullable', 'numeric', 'between:-180,180'],
            'qr_token' => ['required_if:method,qr', 'nullable', 'string'],
            'office_id' => ['required_if:method,qr', 'nullable', 'integer', 'exists:offices,id'],
        ]);

        $employee = $request->user()->employee;
        abort_if(! $employee, 422, 'No employee profile is linked to your account.');

        $record = $this->attendance->clockIn($employee, $data);

        return $this->respond($this->present($record), 201);
    }

    public function clockOut(Request $request): JsonResponse
    {
        $data = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ]);

        $employee = $request->user()->employee;
        abort_if(! $employee, 422, 'No employee profile is linked to your account.');

        return $this->respond($this->present($this->attendance->clockOut($employee, $data)));
    }

    public function index(Request $request): JsonResponse
    {
        $this->requirePermission('hr.attendance.view');

        $records = AttendanceRecord::query()
            ->with(['employee:id,first_name,last_name,employee_code', 'office:id,name'])
            ->when($request->query('employee_id'), fn ($q, $id) => $q->where('employee_id', $id))
            ->when($request->query('from'), fn ($q, $from) => $q->whereDate('work_date', '>=', $from))
            ->when($request->query('to'), fn ($q, $to) => $q->whereDate('work_date', '<=', $to))
            ->when($request->boolean('late'), fn ($q) => $q->where('is_late', true))
            ->orderByDesc('work_date')
            ->cursorPaginate(min((int) $request->query('per_page', 25), 100));

        return $this->respond(
            collect($records->items())->map(fn (AttendanceRecord $r) => $this->present($r)),
            200,
            ['pagination' => ['next_cursor' => $records->nextCursor()?->encode(), 'per_page' => $records->perPage()]],
        );
    }

    public function today(): JsonResponse
    {
        $this->requirePermission('hr.attendance.view');

        $records = AttendanceRecord::query()
            ->with(['employee:id,first_name,last_name', 'office:id,name'])
            ->whereDate('work_date', now()->toDateString())
            ->orderBy('clocked_in_at')
            ->get();

        return $this->respond([
            'summary' => [
                'present' => $records->count(),
                'late' => $records->where('is_late', true)->count(),
            ],
            'records' => $records->map(fn (AttendanceRecord $r) => $this->present($r)),
        ]);
    }

    private function present(AttendanceRecord $r): array
    {
        return [
            'id' => $r->id,
            'employee' => $r->relationLoaded('employee') ? $r->employee?->full_name : null,
            'office' => $r->relationLoaded('office') ? $r->office?->name : null,
            'work_date' => $r->work_date->toDateString(),
            'clocked_in_at' => $r->clocked_in_at?->toIso8601String(),
            'clocked_out_at' => $r->clocked_out_at?->toIso8601String(),
            'method' => $r->method,
            'is_late' => $r->is_late,
            'minutes_late' => $r->minutes_late,
            'left_early' => $r->left_early,
        ];
    }
}
