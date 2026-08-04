<?php

namespace Tests\Feature;

use App\Core\Notifications\LeaveSubmitted;
use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class TeamTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function employeeFor(User $user, string $first, ?int $managerId = null): Employee
    {
        return Employee::withoutGlobalScopes()->create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'employee_code' => 'G3N-'.random_int(1000, 9999),
            'first_name' => $first,
            'last_name' => 'Test',
            'manager_id' => $managerId,
            'employment_type' => 'full_time',
            'status' => 'active',
            'hired_at' => now()->subMonths(6),
        ]);
    }

    public function test_team_lead_sees_only_their_direct_reports_with_today_status(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();

        $leadUser = $this->createUserWithRole($tenant, 'team_lead');
        $lead = $this->employeeFor($leadUser, 'Lead');

        $reportOneUser = $this->createUserWithRole($tenant, 'employee');
        $reportOne = $this->employeeFor($reportOneUser, 'Amaka', $lead->id);
        $reportTwoUser = $this->createUserWithRole($tenant, 'employee');
        $this->employeeFor($reportTwoUser, 'Bola', $lead->id);

        // Somebody else's report must not appear.
        $otherLeadUser = $this->createUserWithRole($tenant, 'team_lead');
        $otherLead = $this->employeeFor($otherLeadUser, 'Other');
        $outsiderUser = $this->createUserWithRole($tenant, 'employee');
        $this->employeeFor($outsiderUser, 'Outsider', $otherLead->id);

        // Amaka clocked in late today.
        AttendanceRecord::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'employee_id' => $reportOne->id,
            'work_date' => now()->toDateString(),
            'clocked_in_at' => now()->setTime(9, 45),
            'method' => 'web',
            'is_late' => true,
            'minutes_late' => 45,
        ]);

        $response = $this->actingAsTenantUser($leadUser)->getJson('/api/v1/hr/team')->assertOk()->json();
        $team = collect($response['data']);

        $this->assertCount(2, $team);
        $this->assertEqualsCanonicalizing(['Amaka Test', 'Bola Test'], $team->pluck('name')->all());
        $this->assertSame('late', $team->firstWhere('name', 'Amaka Test')['today']);
        $this->assertSame('absent', $team->firstWhere('name', 'Bola Test')['today']);
        $this->assertSame(2, $response['meta']['team_size']);
        $this->assertSame(1, $response['meta']['present_today']);
        $this->assertSame('direct_reports', $response['meta']['scope']);
        $this->assertTrue($response['meta']['can_approve_leave']);
    }

    public function test_a_direct_report_leave_request_notifies_their_manager(): void
    {
        Notification::fake();

        $this->seedCatalog();
        $tenant = $this->createTenant();

        // A lead who cannot approve on their own is still told about it.
        $leadUser = $this->createUserWithRole($tenant, 'employee');
        $lead = $this->employeeFor($leadUser, 'Manager');

        $staffUser = $this->createUserWithRole($tenant, 'employee');
        $this->employeeFor($staffUser, 'Reportee', $lead->id);

        $type = LeaveType::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id, 'name' => 'Annual', 'days_per_year' => 20,
        ]);

        $this->actingAsTenantUser($staffUser)
            ->postJson('/api/v1/hr/leave-requests', [
                'leave_type_id' => $type->id,
                'start_date' => now()->addWeek()->next('Monday')->toDateString(),
                'end_date' => now()->addWeek()->next('Tuesday')->toDateString(),
                'reason' => 'Family event',
            ])
            ->assertCreated();

        Notification::assertSentTo($leadUser, LeaveSubmitted::class);
        $this->assertSame(1, LeaveRequest::withoutGlobalScopes()->count());
    }

    public function test_team_view_requires_permission_and_handles_no_record(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();

        $staff = $this->createUserWithRole($tenant, 'employee');
        $this->actingAsTenantUser($staff)->getJson('/api/v1/hr/team')->assertForbidden();

        // A lead with no employee record of their own gets an empty team, not an error.
        $leadUser = $this->createUserWithRole($tenant, 'team_lead');
        $response = $this->actingAsTenantUser($leadUser)->getJson('/api/v1/hr/team')->assertOk()->json();
        $this->assertSame([], $response['data']);
        $this->assertFalse($response['meta']['has_employee_record']);
    }

    public function test_hr_can_see_the_whole_company_and_assign_managers(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $leadUser = $this->createUserWithRole($tenant, 'team_lead');
        $lead = $this->employeeFor($leadUser, 'Lead');
        $staffUser = $this->createUserWithRole($tenant, 'employee');
        $staff = $this->employeeFor($staffUser, 'Staff');

        // HR assigns the reporting line.
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/employees/{$staff->public_id}", ['manager_id' => $lead->id])
            ->assertOk()
            ->assertJsonPath('data.manager', 'Lead Test');

        // The lead now sees them.
        $team = $this->actingAsTenantUser($leadUser)->getJson('/api/v1/hr/team')->json('data');
        $this->assertCount(1, $team);

        // HR can widen the scope to everyone.
        $all = $this->actingAsTenantUser($hr)->getJson('/api/v1/hr/team?all=1')->json();
        $this->assertSame('all', $all['meta']['scope']);
        $this->assertCount(2, $all['data']);
    }
}
