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
        return $this->respond(
            LeaveType::query()->withCount('requests')->orderBy('name')->get()
                ->map(fn (LeaveType $t) => $this->presentType($t)),
        );
    }

    public function storeType(Request $request): JsonResponse
    {
        $this->requirePermission('hr.leave.manage');

        $data = $request->validate($this->typeRules());

        $type = LeaveType::create($data + ['tenant_id' => app(\App\Core\Tenancy\TenantContext::class)->id()]);

        return $this->respond($this->presentType($type->loadCount('requests')), 201);
    }

    public function updateType(Request $request, LeaveType $leaveType): JsonResponse
    {
        $this->requirePermission('hr.leave.manage');

        $leaveType->update($request->validate($this->typeRules($leaveType->id)));

        return $this->respond($this->presentType($leaveType->fresh()->loadCount('requests')));
    }

    public function destroyType(LeaveType $leaveType): JsonResponse
    {
        $this->requirePermission('hr.leave.manage');

        // Deleting a type that people have already booked against would strand
        // their history, so it is blocked rather than cascaded.
        abort_if(
            $leaveType->requests()->exists(),
            422,
            'Staff have already booked this leave type — rename it instead of deleting it.',
        );

        $leaveType->delete();

        return $this->respond(['deleted' => true]);
    }

    /** @return array<string, array<int, mixed>> */
    private function typeRules(?int $ignoreId = null): array
    {
        return [
            'name' => [
                'required', 'string', 'max:80',
                \Illuminate\Validation\Rule::unique('leave_types', 'name')
                    ->where('tenant_id', app(\App\Core\Tenancy\TenantContext::class)->id())
                    ->ignore($ignoreId),
            ],
            'days_per_year' => ['required', 'integer', 'min:0', 'max:365'],
            'requires_approval' => ['sometimes', 'boolean'],
            'is_paid' => ['sometimes', 'boolean'],
        ];
    }

    private function presentType(LeaveType $t): array
    {
        return [
            'id' => $t->id,
            'name' => $t->name,
            'days_per_year' => $t->days_per_year,
            'requires_approval' => (bool) $t->requires_approval,
            'is_paid' => (bool) $t->is_paid,
            'in_use' => (int) ($t->requests_count ?? 0) > 0,
        ];
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
