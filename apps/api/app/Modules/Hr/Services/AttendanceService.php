<?php

namespace App\Modules\Hr\Services;

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\Office;
use Illuminate\Validation\ValidationException;

class AttendanceService
{
    /**
     * Clock an employee in for today, validating the method's proof:
     * GPS must be inside the office geofence, QR must carry a fresh token.
     */
    public function clockIn(Employee $employee, array $data): AttendanceRecord
    {
        $today = now()->toDateString();

        $existing = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('work_date', $today)
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'clock_in' => 'You have already clocked in today.',
            ]);
        }

        $method = $data['method'];
        $office = isset($data['office_id']) ? Office::query()->findOrFail($data['office_id']) : null;

        if ($method === 'gps') {
            $office = $this->assertInsideGeofence($office, (float) $data['latitude'], (float) $data['longitude']);
        }

        if ($method === 'qr') {
            if (! $office || ! $office->verifyQrToken((string) ($data['qr_token'] ?? ''))) {
                throw ValidationException::withMessages([
                    'qr_token' => 'This QR code has expired. Scan the current code at the office display.',
                ]);
            }
        }

        [$isLate, $minutesLate] = $this->lateness($employee);

        return AttendanceRecord::create([
            'employee_id' => $employee->id,
            'office_id' => $office?->id,
            'work_date' => $today,
            'clocked_in_at' => now(),
            'method' => $method,
            'in_latitude' => $data['latitude'] ?? null,
            'in_longitude' => $data['longitude'] ?? null,
            'is_late' => $isLate,
            'minutes_late' => $minutesLate,
        ]);
    }

    public function clockOut(Employee $employee, array $data = []): AttendanceRecord
    {
        $record = AttendanceRecord::query()
            ->where('employee_id', $employee->id)
            ->whereDate('work_date', now()->toDateString())
            ->whereNull('clocked_out_at')
            ->first();

        if (! $record) {
            throw ValidationException::withMessages([
                'clock_out' => 'No open attendance record found for today.',
            ]);
        }

        $leftEarly = false;
        if ($schedule = $employee->workSchedule) {
            $endsAt = now()->setTimeFromTimeString($schedule->ends_at);
            $leftEarly = now()->lt($endsAt);
        }

        $record->update([
            'clocked_out_at' => now(),
            'out_latitude' => $data['latitude'] ?? null,
            'out_longitude' => $data['longitude'] ?? null,
            'left_early' => $leftEarly,
        ]);

        return $record;
    }

    /** Find the office whose geofence contains the point, or fail. */
    private function assertInsideGeofence(?Office $office, float $lat, float $lng): Office
    {
        $candidates = $office ? collect([$office]) : Office::query()->whereNotNull('latitude')->get();

        foreach ($candidates as $candidate) {
            if ($candidate->latitude === null) {
                continue;
            }
            if ($candidate->distanceFrom($lat, $lng) <= $candidate->geofence_radius_m) {
                return $candidate;
            }
        }

        $nearest = $candidates
            ->filter(fn (Office $o) => $o->latitude !== null)
            ->map(fn (Office $o) => round($o->distanceFrom($lat, $lng)))
            ->min();

        throw ValidationException::withMessages([
            'location' => $nearest !== null
                ? "You are {$nearest}m from the nearest office — inside the geofence is required to clock in."
                : 'No office with a configured location was found.',
        ]);
    }

    /** @return array{0: bool, 1: int} [isLate, minutesLate] */
    private function lateness(Employee $employee): array
    {
        $schedule = $employee->workSchedule;
        if (! $schedule) {
            return [false, 0];
        }

        $deadline = now()
            ->setTimeFromTimeString($schedule->starts_at)
            ->addMinutes($schedule->grace_minutes);

        if (now()->lte($deadline)) {
            return [false, 0];
        }

        $startedAt = now()->setTimeFromTimeString($schedule->starts_at);

        return [true, (int) abs(now()->diffInMinutes($startedAt))];
    }
}
