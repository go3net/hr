<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class SelfServiceProfileTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function employeeFor(User $user, array $attributes = []): Employee
    {
        return Employee::withoutGlobalScopes()->create(array_merge([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'employee_code' => 'G3N-'.random_int(1000, 9999),
            'first_name' => 'Chidi',
            'last_name' => 'Obi',
            'employment_type' => 'full_time',
            'status' => 'active',
            'hired_at' => now()->subMonth(),
        ], $attributes));
    }

    public function test_employee_completes_their_own_profile(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $staff = $this->createUserWithRole($tenant, 'employee');
        $employee = $this->employeeFor($staff);

        $initial = $this->actingAsTenantUser($staff)
            ->getJson('/api/v1/hr/me/profile')
            ->assertOk()
            ->json('data');
        $this->assertSame(0, $initial['completeness']['percent']);
        $this->assertSame('Chidi', $initial['first_name']);

        $updated = $this->actingAsTenantUser($staff)
            ->patchJson('/api/v1/hr/me/profile', [
                'phone' => '08031112222',
                'date_of_birth' => '1995-04-12',
                'gender' => 'male',
                'marital_status' => 'single',
                'address' => '12 Admiralty Way, Lekki',
                'nin' => '12345678901',
                'bvn' => '22233344455',
                'bank_name' => 'GTBank',
                'bank_account_number' => '0123456789',
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame('08031112222', $updated['phone']);
        $this->assertSame('GTBank', $updated['bank_name']);
        // 9 of 9 fields, still missing a contact and a guarantor → 9/11.
        $this->assertSame((int) round(9 / 11 * 100), $updated['completeness']['percent']);

        // Next of kin and guarantor complete the file.
        $this->actingAsTenantUser($staff)
            ->postJson('/api/v1/hr/me/profile/emergency-contacts', [
                'name' => 'Ngozi Obi', 'relationship' => 'Sister', 'phone' => '08039998888',
            ])
            ->assertOk();

        $complete = $this->actingAsTenantUser($staff)
            ->postJson('/api/v1/hr/me/profile/guarantors', [
                'name' => 'Emeka Obi', 'occupation' => 'Banker', 'phone' => '08037776666',
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame(100, $complete['completeness']['percent']);
        $this->assertCount(1, $complete['emergency_contacts']);
        $this->assertCount(1, $complete['guarantors']);

        // HR sees the same details and the completion score on the roster.
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $row = collect($this->actingAsTenantUser($hr)->getJson('/api/v1/hr/employees')->json('data'))
            ->firstWhere('employee_code', $employee->employee_code);
        $this->assertSame(100, $row['profile_percent']);

        $detail = $this->actingAsTenantUser($hr)
            ->getJson("/api/v1/hr/employees/{$employee->public_id}")
            ->json('data');
        $this->assertSame('12345678901', $detail['nin']);
        $this->assertSame('0123456789', $detail['bank_account_number']);
    }

    public function test_self_service_rejects_bad_data_and_protects_hr_fields(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $staff = $this->createUserWithRole($tenant, 'employee');
        $this->employeeFor($staff, ['base_salary' => 500000, 'status' => 'active']);

        // NIN/BVN/account number are fixed-length digits.
        $this->actingAsTenantUser($staff)
            ->patchJson('/api/v1/hr/me/profile', ['nin' => '123'])
            ->assertUnprocessable();
        $this->actingAsTenantUser($staff)
            ->patchJson('/api/v1/hr/me/profile', ['bank_account_number' => 'abcdefghij'])
            ->assertUnprocessable();

        // Pay, status and role fields are ignored — HR owns them.
        $this->actingAsTenantUser($staff)
            ->patchJson('/api/v1/hr/me/profile', [
                'phone' => '08000000000', 'base_salary' => 9_000_000, 'status' => 'exited',
            ])
            ->assertOk();

        $employee = Employee::withoutGlobalScopes()->where('user_id', $staff->id)->sole();
        $this->assertEquals(500000, $employee->base_salary);
        $this->assertSame('active', $employee->status);
    }

    public function test_account_without_an_employee_record_gets_a_clear_message(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $orphan = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($orphan)
            ->getJson('/api/v1/hr/me/profile')
            ->assertNotFound()
            ->assertJsonPath('error.code', 'NO_EMPLOYEE_RECORD');
    }

    public function test_people_cannot_touch_another_employees_next_of_kin(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $alice = $this->createUserWithRole($tenant, 'employee');
        $bob = $this->createUserWithRole($tenant, 'employee');
        $this->employeeFor($alice);
        $this->employeeFor($bob, ['first_name' => 'Bob']);

        $contactId = $this->actingAsTenantUser($alice)
            ->postJson('/api/v1/hr/me/profile/emergency-contacts', [
                'name' => 'Ngozi', 'relationship' => 'Sister', 'phone' => '08031112222',
            ])
            ->json('data.emergency_contacts.0.id');

        $this->actingAsTenantUser($bob)
            ->deleteJson("/api/v1/hr/me/profile/emergency-contacts/{$contactId}")
            ->assertForbidden();
    }
}
