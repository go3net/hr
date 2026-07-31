<?php

namespace App\Modules\Hr\Http;

use App\Core\Http\ApiController;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Modules\Hr\Services\LeaveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveController extends ApiController
{
    public function __construct(private readonly LeaveService $leave)
    {
    }

    public function types(): JsonResponse
    {
        return $this->respond(LeaveType::query()->orderBy('name')->get());
    }

    public function index(Request $request): JsonResponse
    {
        $canViewAll = $request->user()->hasPermission('hr.leave.view');
        $ownEmployeeId = $request->user()->employee?->id;

        $requests = LeaveRequest::query()
            ->with(['employee:id,first_name,last_name', 'leaveType:id,name'])
            ->when(! $canViewAll, fn ($q) => $q->where('employee_id', $ownEmployeeId ?? 0))
            ->when($request->query('filter.status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->cursorPaginate(min((int) $request->query('per_page', 25), 100));

        return $this->respond(
            collect($requests->items())->map(fn (LeaveRequest $r) => $this->present($r)),
            200,
            ['pagination' => ['next_cursor' => $requests->nextCursor()?->encode(), 'per_page' => $requests->perPage()]],
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'leave_type_id' => ['required', 'integer', 'exists:leave_types,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $employee = $request->user()->employee;
        abort_if(! $employee, 422, 'No employee profile is linked to your account.');

        return $this->respond($this->present($this->leave->submit($employee, $data)), 201);
    }

    public function approve(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->requirePermission('hr.leave.approve');

        $note = $request->validate(['note' => ['nullable', 'string', 'max:500']])['note'] ?? null;

        return $this->respond($this->present($this->leave->approve($leaveRequest, $request->user(), $note)));
    }

    public function reject(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->requirePermission('hr.leave.approve');

        $note = $request->validate(['note' => ['nullable', 'string', 'max:500']])['note'] ?? null;

        return $this->respond($this->present($this->leave->reject($leaveRequest, $request->user(), $note)));
    }

    public function balances(Request $request): JsonResponse
    {
        $employee = $request->user()->employee;
        abort_if(! $employee, 422, 'No employee profile is linked to your account.');

        $year = (int) $request->query('year', now()->year);

        $balances = LeaveType::query()->orderBy('name')->get()->map(function (LeaveType $type) use ($employee, $year) {
            $balance = $this->leave->balanceFor($employee, $type, $year);

            return [
                'type' => $type->name,
                'entitled' => (float) $balance->entitled_days,
                'used' => (float) $balance->used_days,
                'remaining' => $balance->remainingDays(),
            ];
        });

        return $this->respond($balances);
    }

    private function present(LeaveRequest $r): array
    {
        return [
            'id' => $r->id,
            'employee' => $r->relationLoaded('employee') ? $r->employee?->full_name : $r->employee()->first()?->full_name,
            'type' => $r->relationLoaded('leaveType') ? $r->leaveType?->name : $r->leaveType()->first()?->name,
            'start_date' => $r->start_date->toDateString(),
            'end_date' => $r->end_date->toDateString(),
            'days' => (float) $r->days,
            'reason' => $r->reason,
            'status' => $r->status,
        ];
    }
}
