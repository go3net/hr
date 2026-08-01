<?php

namespace Tests\Feature;

use App\Core\Notifications\LeaveDecided;
use App\Core\Notifications\LeaveSubmitted;
use App\Core\Notifications\PayslipPublished;
use App\Core\Notifications\TaskAssigned;
use App\Models\Employee;
use App\Models\LeaveType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_task_assignment_notifies_the_assignee_not_the_actor(): void
    {
        Notification::fake();
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $pm = $this->createUserWithRole($tenant, 'project_manager');
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($pm)->postJson('/api/v1/tasks', [
            'title' => 'Ship the landing page',
            'assignee_ids' => [$employee->id, $pm->id],
        ])->assertCreated();

        Notification::assertSentTo($employee, TaskAssigned::class);
        Notification::assertNotSentTo($pm, TaskAssigned::class);
    }

    public function test_leave_flow_notifies_approvers_then_the_employee(): void
    {
        Notification::fake();
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $employeeUser = $this->createUserWithRole($tenant, 'employee');

        Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $employeeUser->id,
            'employee_code' => 'E-1',
            'first_name' => 'Test',
            'last_name' => 'Person',
        ]);
        $type = LeaveType::create(['tenant_id' => $tenant->id, 'name' => 'Annual', 'days_per_year' => 20]);

        $id = $this->actingAsTenantUser($employeeUser)->postJson('/api/v1/hr/leave-requests', [
            'leave_type_id' => $type->id,
            'start_date' => '2026-08-03',
            'end_date' => '2026-08-04',
        ])->assertCreated()->json('data.id');

        Notification::assertSentTo($hr, LeaveSubmitted::class);
        Notification::assertNotSentTo($employeeUser, LeaveSubmitted::class);

        $this->actingAsTenantUser($hr)->postJson("/api/v1/hr/leave-requests/{$id}/approve")->assertOk();

        Notification::assertSentTo($employeeUser, LeaveDecided::class);
    }

    public function test_publishing_payroll_notifies_employees_with_accounts(): void
    {
        Notification::fake();
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $finance = $this->createUserWithRole($tenant, 'finance');
        $employeeUser = $this->createUserWithRole($tenant, 'employee');

        Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $employeeUser->id,
            'employee_code' => 'E-1',
            'first_name' => 'Test',
            'last_name' => 'Person',
            'base_salary' => 300_000,
        ]);

        $run = $this->actingAsTenantUser($finance)
            ->postJson('/api/v1/hr/payroll/runs', ['period' => '2026-07'])
            ->json('data');
        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$run['id']}/approve");
        $this->actingAsTenantUser($finance)->postJson("/api/v1/hr/payroll/runs/{$run['id']}/publish");

        Notification::assertSentTo($employeeUser, PayslipPublished::class);
    }

    public function test_notification_center_lists_counts_and_marks_read(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $pm = $this->createUserWithRole($tenant, 'project_manager');
        $employee = $this->createUserWithRole($tenant, 'employee');

        // Real (non-faked) notification via the database channel.
        $this->actingAsTenantUser($pm)->postJson('/api/v1/tasks', [
            'title' => 'Review the deck',
            'assignee_ids' => [$employee->id],
        ])->assertCreated();

        $list = $this->actingAsTenantUser($employee)
            ->getJson('/api/v1/notifications')
            ->assertOk()
            ->json('data');

        $this->assertSame(1, $list['unread_count']);
        $this->assertStringContainsString('Review the deck', $list['notifications'][0]['body']);
        $this->assertFalse($list['notifications'][0]['read']);

        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('data.unread_count', 0);

        $bootstrap = $this->actingAsTenantUser($employee)
            ->getJson('/api/v1/me/bootstrap')
            ->assertOk()
            ->json('data');
        $this->assertSame(0, $bootstrap['unread_notifications']);
    }
}
