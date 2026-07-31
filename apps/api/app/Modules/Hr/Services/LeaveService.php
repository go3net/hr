<?php

namespace App\Modules\Hr\Services;

use App\Core\Notifications\LeaveDecided;
use App\Core\Notifications\LeaveSubmitted;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Models\LeaveApproval;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonPeriod;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LeaveService
{
    public function submit(Employee $employee, array $data): LeaveRequest
    {
        $type = LeaveType::query()->findOrFail($data['leave_type_id']);
        $start = Carbon::parse($data['start_date']);
        $end = Carbon::parse($data['end_date']);

        if ($end->lt($start)) {
            throw ValidationException::withMessages(['end_date' => 'End date must be after the start date.']);
        }

        $days = $this->workingDays($start, $end);

        $balance = $this->balanceFor($employee, $type, $start->year);
        if ($balance->remainingDays() < $days) {
            throw ValidationException::withMessages([
                'days' => "Insufficient {$type->name} leave balance: {$balance->remainingDays()} day(s) left, {$days} requested.",
            ]);
        }

        $overlap = LeaveRequest::query()
            ->where('employee_id', $employee->id)
            ->whereIn('status', ['pending', 'approved'])
            ->where('start_date', '<=', $end->toDateString())
            ->where('end_date', '>=', $start->toDateString())
            ->exists();

        if ($overlap) {
            throw ValidationException::withMessages([
                'start_date' => 'You already have a leave request overlapping these dates.',
            ]);
        }

        $request = LeaveRequest::create([
            'employee_id' => $employee->id,
            'leave_type_id' => $type->id,
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'days' => $days,
            'reason' => $data['reason'] ?? null,
            'status' => $type->requires_approval ? 'pending' : 'approved',
        ]);

        if (! $type->requires_approval) {
            $this->consumeBalance($request);
        }

        AuditLog::record('leave.submitted', $request);

        if ($request->status === 'pending') {
            $range = "{$start->toFormattedDateString()} – {$end->toFormattedDateString()}";
            $this->approversFor($employee)->each(
                fn (User $approver) => $approver->notify(
                    new LeaveSubmitted($employee->full_name, $type->name, $range),
                ),
            );
        }

        return $request;
    }

    /** Users in this tenant whose roles carry hr.leave.approve (not the requester). */
    private function approversFor(Employee $employee): \Illuminate\Support\Collection
    {
        return User::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('id', '!=', $employee->user_id)
            ->whereHas('roles.permissions', fn ($q) => $q->where('key', 'hr.leave.approve'))
            ->get();
    }

    public function approve(LeaveRequest $request, User $approver, ?string $note = null): LeaveRequest
    {
        $this->assertPending($request);

        return DB::transaction(function () use ($request, $approver, $note) {
            LeaveApproval::create([
                'leave_request_id' => $request->id,
                'approver_id' => $approver->id,
                'decision' => 'approved',
                'note' => $note,
                'decided_at' => now(),
            ]);

            $request->update(['status' => 'approved']);
            $this->consumeBalance($request);

            AuditLog::record('leave.approved', $request);
            $request->employee->user?->notify(new LeaveDecided($request->leaveType->name, 'approved', $note));

            return $request->refresh();
        });
    }

    public function reject(LeaveRequest $request, User $approver, ?string $note = null): LeaveRequest
    {
        $this->assertPending($request);

        LeaveApproval::create([
            'leave_request_id' => $request->id,
            'approver_id' => $approver->id,
            'decision' => 'rejected',
            'note' => $note,
            'decided_at' => now(),
        ]);

        $request->update(['status' => 'rejected']);
        AuditLog::record('leave.rejected', $request);
        $request->employee->user?->notify(new LeaveDecided($request->leaveType->name, 'rejected', $note));

        return $request->refresh();
    }

    public function balanceFor(Employee $employee, LeaveType $type, int $year): LeaveBalance
    {
        return LeaveBalance::query()->firstOrCreate(
            ['employee_id' => $employee->id, 'leave_type_id' => $type->id, 'year' => $year],
            ['entitled_days' => $type->days_per_year, 'used_days' => 0],
        );
    }

    /** Working days between two dates, excluding weekends. */
    public function workingDays(Carbon $start, Carbon $end): float
    {
        $days = 0;
        foreach (CarbonPeriod::create($start, $end) as $day) {
            if (! $day->isWeekend()) {
                $days++;
            }
        }

        return (float) $days;
    }

    private function consumeBalance(LeaveRequest $request): void
    {
        $balance = $this->balanceFor(
            $request->employee,
            $request->leaveType,
            Carbon::parse($request->start_date)->year,
        );

        $balance->increment('used_days', (float) $request->days);
    }

    private function assertPending(LeaveRequest $request): void
    {
        if ($request->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => "This request has already been {$request->status}.",
            ]);
        }
    }
}
