<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\User;
use App\Models\WorkSchedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

/**
 * Resumption hours drive late detection. The table existed but nothing could
 * create or edit one, and a freshly registered workspace got none at all — so
 * nobody was ever marked late.
 */
class WorkScheduleTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_registering_a_workspace_creates_working_hours_and_leave_types(): void
    {
        $this->seedCatalog();

        $this->postJson('/api/v1/auth/register', [
            'company' => 'Bright Ltd',
            'subdomain' => 'bright',
            'name' => 'Owner Person',
            'email' => 'owner@bright.test',
            'password' => 'Str0ng-Passw0rd',
        ])->assertCreated();

        $schedule = WorkSchedule::withoutGlobalScopes()->first();
        $this->assertNotNull($schedule, 'A new workspace should start with working hours.');
        $this->assertSame('09:00', substr((string) $schedule->starts_at, 0, 5));
        $this->assertSame([1, 2, 3, 4, 5], $schedule->work_days);

        $this->assertDatabaseHas('leave_types', ['name' => 'Annual']);
    }

    public function test_hr_can_edit_the_resumption_time(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $schedule = $this->actingAs($hr)
            ->postJson('/api/v1/hr/work-schedules', [
                'name' => 'Early shift',
                'starts_at' => '07:30',
                'ends_at' => '15:30',
                'grace_minutes' => 10,
                'work_days' => [1, 2, 3, 4, 5, 6],
            ])
            ->assertCreated()
            ->assertJsonPath('data.starts_at', '07:30')
            ->assertJsonPath('data.grace_minutes', 10)
            ->json('data');

        $this->actingAs($hr)
            ->patchJson("/api/v1/hr/work-schedules/{$schedule['id']}", [
                'name' => 'Early shift',
                'starts_at' => '08:00',
                'ends_at' => '16:00',
                'grace_minutes' => 5,
                'work_days' => [1, 2, 3, 4, 5],
            ])
            ->assertOk()
            ->assertJsonPath('data.starts_at', '08:00')
            ->assertJsonPath('data.work_days', [1, 2, 3, 4, 5]);
    }

    public function test_closing_time_must_follow_the_resumption_time(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $this->actingAs($hr)
            ->postJson('/api/v1/hr/work-schedules', [
                'name' => 'Backwards',
                'starts_at' => '17:00',
                'ends_at' => '09:00',
                'grace_minutes' => 0,
                'work_days' => [1],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('ends_at');
    }

    public function test_a_schedule_in_use_cannot_be_deleted(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $schedule = WorkSchedule::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Standard hours',
            'starts_at' => '09:00',
            'ends_at' => '17:00',
            'grace_minutes' => 15,
            'work_days' => [1, 2, 3, 4, 5],
        ]);

        Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'employee_code' => 'G3N-0500',
            'first_name' => 'Ada',
            'last_name' => 'Obi',
            'employment_type' => 'full_time',
            'status' => 'active',
            'work_schedule_id' => $schedule->id,
        ]);

        $this->actingAs($hr)
            ->deleteJson("/api/v1/hr/work-schedules/{$schedule->id}")
            ->assertStatus(422);

        $this->actingAs($hr)
            ->getJson('/api/v1/hr/work-schedules')
            ->assertOk()
            ->assertJsonPath('data.0.employees_count', 1);
    }

    public function test_staff_cannot_change_working_hours(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $staff = $this->createUserWithRole($tenant, 'employee');

        $this->actingAs($staff)
            ->postJson('/api/v1/hr/work-schedules', [
                'name' => 'Mine',
                'starts_at' => '11:00',
                'ends_at' => '15:00',
                'grace_minutes' => 60,
                'work_days' => [1],
            ])
            ->assertForbidden();
    }

    public function test_terminating_closes_access_but_keeps_the_record(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $leaver = $this->createUserWithRole($tenant, 'employee', ['email' => 'leaver@example.test']);
        $employee = Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $leaver->id,
            'employee_code' => 'G3N-0600',
            'first_name' => 'Sade',
            'last_name' => 'Bello',
            'employment_type' => 'full_time',
            'status' => 'active',
        ]);
        $leaver->createToken('phone');

        $this->actingAs($hr)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/terminate", [
                'exit_date' => now()->toDateString(),
                'reason' => 'resigned',
                'notes' => 'Moving abroad.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'exited');

        // The person and their history survive; only access is closed.
        $this->assertDatabaseHas('employees', ['id' => $employee->id, 'status' => 'exited']);
        $this->assertDatabaseHas('employment_events', [
            'employee_id' => $employee->id,
            'type' => 'exit',
        ]);
        $this->assertSame('disabled', User::withoutGlobalScopes()->find($leaver->id)->status);
        $this->assertSame(0, $leaver->tokens()->count(), 'Open sessions should not outlive termination.');

        // Terminating twice is a mistake, not a no-op.
        $this->actingAs($hr)
            ->postJson("/api/v1/hr/employees/{$employee->public_id}/terminate", [
                'exit_date' => now()->toDateString(),
                'reason' => 'resigned',
            ])
            ->assertStatus(422);
    }

    public function test_deleting_an_employee_removes_them_from_the_list(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $employee = Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'employee_code' => 'G3N-0700',
            'first_name' => 'Typo',
            'last_name' => 'Record',
            'employment_type' => 'full_time',
            'status' => 'active',
        ]);

        $this->actingAs($hr)
            ->deleteJson("/api/v1/hr/employees/{$employee->public_id}")
            ->assertNoContent();

        $this->actingAs($hr)
            ->getJson('/api/v1/hr/employees')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }
}
