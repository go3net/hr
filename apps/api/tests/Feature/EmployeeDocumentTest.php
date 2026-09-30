<?php

namespace Tests\Feature;

use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class EmployeeDocumentTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpPeople(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $staffUser = $this->createUserWithRole($tenant, 'employee');

        $staff = Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $staffUser->id,
            'employee_code' => 'E-1',
            'first_name' => 'Tunde',
            'last_name' => 'Bakare',
            'hire_date' => now()->subYear(),
            'status' => 'active',
        ]);

        return [$tenant, $hr, $staffUser, $staff];
    }

    public function test_hr_can_file_an_id_card_against_a_person_and_download_it_back(): void
    {
        Storage::fake();
        [, $hr, , $staff] = $this->setUpPeople();

        $document = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$staff->public_id}/documents", [
                'file' => UploadedFile::fake()->create('nin-slip.pdf', 120, 'application/pdf'),
                'type' => 'id_card',
                'expires_on' => now()->addYear()->toDateString(),
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('id_card', $document['type']);
        $this->assertSame('ID card', $document['type_label']);
        $this->assertSame('nin-slip.pdf', $document['name']);
        $this->assertFalse($document['has_expired']);

        $listed = $this->actingAsTenantUser($hr)
            ->getJson("/api/v1/hr/employees/{$staff->public_id}/documents")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $listed);

        // A filed document nobody can open again is not filed.
        $this->actingAsTenantUser($hr)
            ->get("/api/v1/hr/employees/{$staff->public_id}/documents/{$document['id']}/download")
            ->assertOk()
            ->assertHeader('content-disposition', 'attachment; filename=nin-slip.pdf');
    }

    public function test_staff_may_add_and_read_their_own_paperwork(): void
    {
        Storage::fake();
        [, , $staffUser, $staff] = $this->setUpPeople();

        // So an ID card can arrive during onboarding without HR chasing it.
        $this->actingAsTenantUser($staffUser)
            ->postJson("/api/v1/hr/employees/{$staff->public_id}/documents", [
                'file' => UploadedFile::fake()->create('degree.pdf', 90, 'application/pdf'),
                'type' => 'certificate',
            ])
            ->assertCreated();

        $this->actingAsTenantUser($staffUser)
            ->getJson("/api/v1/hr/employees/{$staff->public_id}/documents")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_staff_cannot_reach_a_colleagues_paperwork(): void
    {
        Storage::fake();
        [$tenant, $hr, , $staff] = $this->setUpPeople();

        $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$staff->public_id}/documents", [
                'file' => UploadedFile::fake()->create('passport.pdf', 50, 'application/pdf'),
                'type' => 'id_card',
            ])
            ->assertCreated();

        $colleagueUser = $this->createUserWithRole($tenant, 'employee');
        Employee::create([
            'tenant_id' => $tenant->id,
            'user_id' => $colleagueUser->id,
            'employee_code' => 'E-2',
            'first_name' => 'Nosy',
            'last_name' => 'Colleague',
            'hire_date' => now(),
            'status' => 'active',
        ]);

        // Somebody's ID card is not workplace reading.
        $this->actingAsTenantUser($colleagueUser)
            ->getJson("/api/v1/hr/employees/{$staff->public_id}/documents")
            ->assertForbidden();
    }

    public function test_only_hr_can_delete_and_the_file_goes_with_the_record(): void
    {
        Storage::fake();
        [, $hr, $staffUser, $staff] = $this->setUpPeople();

        $document = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$staff->public_id}/documents", [
                'file' => UploadedFile::fake()->create('contract.pdf', 70, 'application/pdf'),
                'type' => 'contract',
            ])
            ->assertCreated()
            ->json('data');

        $path = \App\Models\EmployeeDocument::withoutGlobalScopes()->find($document['id'])->path;
        Storage::assertExists($path);

        // Staff may add their own, but not remove what HR filed.
        $this->actingAsTenantUser($staffUser)
            ->deleteJson("/api/v1/hr/employees/{$staff->public_id}/documents/{$document['id']}")
            ->assertForbidden();

        $this->actingAsTenantUser($hr)
            ->deleteJson("/api/v1/hr/employees/{$staff->public_id}/documents/{$document['id']}")
            ->assertOk();

        // A deleted certificate that stays on disk is the worst of both.
        Storage::assertMissing($path);
        $this->assertDatabaseMissing('employee_documents', ['id' => $document['id']]);
    }

    public function test_an_expired_document_is_flagged(): void
    {
        Storage::fake();
        [, $hr, , $staff] = $this->setUpPeople();

        $document = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$staff->public_id}/documents", [
                'file' => UploadedFile::fake()->create('work-permit.pdf', 40, 'application/pdf'),
                'type' => 'other',
                'expires_on' => now()->subMonth()->toDateString(),
            ])
            ->assertCreated()
            ->json('data');

        // A permit that lapsed last month is the thing you need to spot.
        $this->assertTrue($document['has_expired']);
    }

    public function test_a_file_lost_from_storage_says_so_instead_of_failing(): void
    {
        Storage::fake();
        [, $hr, , $staff] = $this->setUpPeople();

        $document = $this->actingAsTenantUser($hr)
            ->postJson("/api/v1/hr/employees/{$staff->public_id}/documents", [
                'file' => UploadedFile::fake()->create('id.pdf', 30, 'application/pdf'),
                'type' => 'id_card',
            ])
            ->assertCreated()
            ->json('data');

        // A host with no persistent storage loses the disk on every deploy
        // while the row survives. Confirmed on production: the download
        // answered 500, which reads like the whole app is broken.
        Storage::delete(\App\Models\EmployeeDocument::withoutGlobalScopes()->find($document['id'])->path);

        $this->actingAsTenantUser($hr)
            ->getJson("/api/v1/hr/employees/{$staff->public_id}/documents/{$document['id']}/download")
            ->assertStatus(410)
            ->assertSee('no longer in storage', false);

        // The row stays listed, so it is visible that something was expected.
        $this->actingAsTenantUser($hr)
            ->getJson("/api/v1/hr/employees/{$staff->public_id}/documents")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
