<?php

namespace Tests\Feature;

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\Office;
use App\Models\WorkSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpEmployee(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        $office = Office::create([
            'tenant_id' => $tenant->id,
            'name' => 'HQ',
            'latitude' => 6.4281,
            'longitude' => 3.4219,
            'geofence_radius_m' => 150,
        ]);

        $schedule = WorkSchedule::create([
            'tenant_id' => $tenant->id,
            'name' => '9-5',
            'starts_at' => '09:00',
            'ends_at' => '17:00',
            'grace_minutes' => 15,
        ]);

        $employee = Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'employee_code' => 'E-1',
            'first_name' => 'Test',
            'last_name' => 'Person',
            'work_schedule_id' => $schedule->id,
        ]);

        return [$tenant, $user, $employee, $office];
    }

    public function test_gps_clock_in_inside_geofence_succeeds(): void
    {
        [, $user] = $this->setUpEmployee();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/hr/attendance/clock-in', [
                'method' => 'gps',
                'latitude' => 6.4282,   // ~15 m from the office
                'longitude' => 3.4220,
            ])
            ->assertCreated()
            ->assertJsonPath('data.method', 'gps');
    }

    public function test_gps_clock_in_outside_geofence_fails(): void
    {
        [, $user] = $this->setUpEmployee();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/hr/attendance/clock-in', [
                'method' => 'gps',
                'latitude' => 6.6, // ~20 km away
                'longitude' => 3.35,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('location');
    }

    public function test_qr_clock_in_with_valid_token_succeeds(): void
    {
        [, $user, , $office] = $this->setUpEmployee();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/hr/attendance/clock-in', [
                'method' => 'qr',
                'office_id' => $office->id,
                'qr_token' => $office->currentQrToken(),
            ])
            ->assertCreated();
    }

    public function test_qr_clock_in_with_stale_token_fails(): void
    {
        [, $user, , $office] = $this->setUpEmployee();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/hr/attendance/clock-in', [
                'method' => 'qr',
                'office_id' => $office->id,
                'qr_token' => 'not-a-valid-token',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('qr_token');
    }

    public function test_late_arrival_is_flagged(): void
    {
        [, $user] = $this->setUpEmployee();

        $this->travelTo(now()->setTime(10, 0)); // 45 min past 09:00 + 15 grace

        $response = $this->actingAsTenantUser($user)
            ->postJson('/api/v1/hr/attendance/clock-in', ['method' => 'web'])
            ->assertCreated();

        $this->assertTrue($response->json('data.is_late'));
        $this->assertSame(60, $response->json('data.minutes_late'));
    }

    public function test_double_clock_in_is_rejected(): void
    {
        [, $user] = $this->setUpEmployee();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/hr/attendance/clock-in', ['method' => 'web'])
            ->assertCreated();

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/hr/attendance/clock-in', ['method' => 'web'])
            ->assertUnprocessable();
    }

    public function test_past_days_stay_on_the_record_and_are_retrievable(): void
    {
        [$tenant, $user, $employee] = $this->setUpEmployee();

        // Three days of history, plus today.
        foreach ([3, 2, 1, 0] as $back) {
            AttendanceRecord::create([
                'tenant_id' => $tenant->id,
                'employee_id' => $employee->id,
                'work_date' => now()->subDays($back)->toDateString(),
                'clocked_in_at' => now()->subDays($back)->setTime(8, 55),
                'clocked_out_at' => now()->subDays($back)->setTime(17, 5),
                'is_late' => $back === 2,
                'method' => 'web',
            ]);
        }

        // Today's view is deliberately just today — that is not where history
        // lives, and reading it as "there is no past record" is the bug this
        // guards against.
        $today = $this->actingAsTenantUser($user)
            ->getJson('/api/v1/hr/attendance/today')
            ->assertOk()
            ->json('data.records');

        $this->assertCount(1, $today);

        // The full list keeps every day.
        $all = $this->actingAsTenantUser($user)
            ->getJson('/api/v1/hr/attendance')
            ->assertOk()
            ->json('data');

        $this->assertCount(4, $all);
        $this->assertSame(now()->toDateString(), $all[0]['work_date'], 'newest first');

        // A date range narrows it without losing anything outside the window.
        $window = $this->actingAsTenantUser($user)
            ->getJson('/api/v1/hr/attendance?from='.now()->subDays(2)->toDateString().'&to='.now()->subDay()->toDateString())
            ->assertOk()
            ->json('data');

        $this->assertCount(2, $window);
        $this->assertEqualsCanonicalizing(
            [now()->subDays(2)->toDateString(), now()->subDay()->toDateString()],
            array_column($window, 'work_date'),
        );

        // And the late filter still reaches back through history.
        $late = $this->actingAsTenantUser($user)
            ->getJson('/api/v1/hr/attendance?late=1')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $late);
        $this->assertSame(now()->subDays(2)->toDateString(), $late[0]['work_date']);
    }
}
