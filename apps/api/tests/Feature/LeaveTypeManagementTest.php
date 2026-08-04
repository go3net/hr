<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

/**
 * Leave types were seeded once and never editable, so a workspace was stuck
 * with whatever it started with and staff could only pick from that.
 */
class LeaveTypeManagementTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_hr_can_create_edit_and_delete_a_leave_type(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $type = $this->actingAs($hr)
            ->postJson('/api/v1/hr/leave-types', [
                'name' => 'Compassionate',
                'days_per_year' => 5,
                'requires_approval' => true,
                'is_paid' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Compassionate')
            ->assertJsonPath('data.days_per_year', 5)
            ->assertJsonPath('data.in_use', false)
            ->json('data');

        $this->actingAs($hr)
            ->patchJson("/api/v1/hr/leave-types/{$type['id']}", [
                'name' => 'Compassionate leave',
                'days_per_year' => 7,
                'is_paid' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Compassionate leave')
            ->assertJsonPath('data.days_per_year', 7)
            ->assertJsonPath('data.is_paid', false);

        $this->actingAs($hr)
            ->deleteJson("/api/v1/hr/leave-types/{$type['id']}")
            ->assertOk();

        $this->assertDatabaseMissing('leave_types', ['id' => $type['id']]);
    }

    public function test_a_type_staff_have_booked_cannot_be_deleted(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $type = LeaveType::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'name' => 'Annual',
            'days_per_year' => 20,
        ]);

        $employee = Employee::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $hr->id,
            'employee_code' => 'G3N-0001',
            'first_name' => 'Hilda',
            'last_name' => 'Test',
            'employment_type' => 'full_time',
            'status' => 'active',
        ]);

        LeaveRequest::withoutGlobalScopes()->create([
            'tenant_id' => $tenant->id,
            'employee_id' => $employee->id,
            'leave_type_id' => $type->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDay()->toDateString(),
            'days' => 2,
            'status' => 'approved',
        ]);

        // Deleting would strand that person's leave history.
        $this->actingAs($hr)
            ->deleteJson("/api/v1/hr/leave-types/{$type->id}")
            ->assertStatus(422);

        $this->assertDatabaseHas('leave_types', ['id' => $type->id]);

        // The list flags it so the UI can disable the delete button.
        $this->actingAs($hr)
            ->getJson('/api/v1/hr/leave-types')
            ->assertOk()
            ->assertJsonPath('data.0.in_use', true);
    }

    public function test_duplicate_names_are_rejected_per_tenant(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $this->actingAs($hr)
            ->postJson('/api/v1/hr/leave-types', ['name' => 'Study', 'days_per_year' => 10])
            ->assertCreated();

        $this->actingAs($hr)
            ->postJson('/api/v1/hr/leave-types', ['name' => 'Study', 'days_per_year' => 5])
            ->assertStatus(422);
    }

    public function test_staff_can_read_types_but_not_change_them(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $staff = $this->createUserWithRole($tenant, 'employee');

        // Reading is what makes the request form's dropdown work.
        $this->actingAs($staff)->getJson('/api/v1/hr/leave-types')->assertOk();

        $this->actingAs($staff)
            ->postJson('/api/v1/hr/leave-types', ['name' => 'Nope', 'days_per_year' => 99])
            ->assertForbidden();
    }
}
