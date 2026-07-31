<?php

namespace Tests\Feature;

use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class RecruitmentTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_opening_and_applicant_pipeline_through_hire(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        $opening = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/recruitment/openings', [
                'title' => 'Senior Laravel Engineer',
                'employment_type' => 'full_time',
                'openings_count' => 2,
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('open', $opening['status']);

        $applicant = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/recruitment/openings/{$opening['id']}/applicants", [
                'name' => 'Chidi Anyanwu',
                'email' => 'chidi@example.com',
                'source' => 'linkedin',
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame('applied', $applicant['stage']);

        // Move through the pipeline with a rating.
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/recruitment/applicants/{$applicant['id']}", [
                'stage' => 'interview', 'rating' => 4,
            ])
            ->assertOk()
            ->assertJsonPath('data.stage', 'interview')
            ->assertJsonPath('data.rating', 4);

        // Hired must go through the hire action.
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/recruitment/applicants/{$applicant['id']}", ['stage' => 'hired'])
            ->assertUnprocessable();

        $hired = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/recruitment/applicants/{$applicant['id']}/hire", [
                'employee_code' => 'G3N-042',
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame('hired', $hired['stage']);
        $this->assertTrue($hired['hired']);
        $this->assertNotEmpty($hired['employee_public_id']);

        $employee = Employee::withoutGlobalScopes()->where('employee_code', 'G3N-042')->sole();
        $this->assertSame('Chidi', $employee->first_name);
        $this->assertSame('Anyanwu', $employee->last_name);
        $this->assertSame($tenant->id, $employee->tenant_id);
        $this->assertSame('full_time', $employee->employment_type);

        // Hiring twice is rejected.
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/recruitment/applicants/{$applicant['id']}/hire", [
                'employee_code' => 'G3N-043',
            ])
            ->assertUnprocessable();

        // Closed openings reject new applicants.
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/recruitment/openings/{$opening['id']}", ['status' => 'closed'])
            ->assertOk();
        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/recruitment/openings/{$opening['id']}/applicants", ['name' => 'Late Larry'])
            ->assertUnprocessable();
    }

    public function test_recruitment_requires_permission(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($employee)->getJson('/api/v1/hr/recruitment/openings')->assertForbidden();
        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/hr/recruitment/openings', ['title' => 'Nope'])
            ->assertForbidden();
    }
}
