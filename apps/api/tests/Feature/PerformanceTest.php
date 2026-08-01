<?php

namespace Tests\Feature;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class PerformanceTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function withEmployee(User $user, string $code): Employee
    {
        return Employee::withoutGlobalScopes()->create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'employee_code' => $code,
            'first_name' => explode(' ', $user->name)[0],
            'last_name' => 'Test',
            'employment_type' => 'full_time',
            'status' => 'active',
            'hired_at' => now()->subYear(),
        ]);
    }

    public function test_objective_with_key_results_and_progress_checkins(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');
        $this->withEmployee($user, 'G3N-100');

        $objective = $this->actingAsTenantUser($user)
            ->postJson('/api/v1/hr/performance/objectives', [
                'title' => 'Grow client retention',
                'period' => '2026-Q3',
                'key_results' => [
                    ['title' => 'Renew 8 contracts', 'target_value' => 8, 'unit' => 'contracts'],
                    ['title' => 'NPS above 40', 'target_value' => 40, 'unit' => 'NPS'],
                ],
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame(0, $objective['progress']);
        $this->assertCount(2, $objective['key_results']);

        // Check in: 4/8 contracts = 50% averaged with 0% NPS → 25%;
        // then NPS 40/40 = 100% → (50 + 100) / 2 = 75%.
        $kr1 = $objective['key_results'][0]['id'];
        $kr2 = $objective['key_results'][1]['id'];

        $this->actingAsTenantUser($user)
            ->patchJson("/api/v1/hr/performance/key-results/{$kr1}", ['current_value' => 4])
            ->assertOk()
            ->assertJsonPath('data.progress', 25);

        $after = $this->actingAsTenantUser($user)
            ->patchJson("/api/v1/hr/performance/key-results/{$kr2}", ['current_value' => 40])
            ->json('data');
        $this->assertSame(75, $after['progress']);

        // Overshooting caps at 100 per key result.
        $capped = $this->actingAsTenantUser($user)
            ->patchJson("/api/v1/hr/performance/key-results/{$kr1}", ['current_value' => 20])
            ->json('data');
        $this->assertSame(100, $capped['progress']);
    }

    public function test_visibility_and_authorization_rules(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $alice = $this->createUserWithRole($tenant, 'employee');
        $bob = $this->createUserWithRole($tenant, 'employee');
        $manager = $this->createUserWithRole($tenant, 'department_manager');
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $aliceEmp = $this->withEmployee($alice, 'G3N-101');
        $this->withEmployee($bob, 'G3N-102');
        $this->withEmployee($hr, 'G3N-103');

        $objective = $this->actingAsTenantUser($alice)
            ->postJson('/api/v1/hr/performance/objectives', [
                'title' => 'Ship the mobile app',
                'period' => '2026-Q3',
                'key_results' => [['title' => 'Release builds', 'target_value' => 2]],
            ])
            ->json('data');

        // Bob sees nothing of Alice's and can't request team scope.
        $this->assertCount(0, $this->actingAsTenantUser($bob)->getJson('/api/v1/hr/performance/objectives')->json('data'));
        $this->actingAsTenantUser($bob)->getJson('/api/v1/hr/performance/objectives?scope=team')->assertForbidden();

        // A department manager (hr.performance.view) sees the team scope.
        $team = $this->actingAsTenantUser($manager)->getJson('/api/v1/hr/performance/objectives?scope=team')->json();
        $this->assertCount(1, $team['data']);
        $this->assertTrue($team['meta']['can_view_all']);
        $this->assertFalse($team['meta']['can_manage']);

        // Bob can't edit Alice's objective; Alice can; HR (manage) can too.
        $kr = $objective['key_results'][0]['id'];
        $this->actingAsTenantUser($bob)
            ->patchJson("/api/v1/hr/performance/key-results/{$kr}", ['current_value' => 1])
            ->assertForbidden();
        $this->actingAsTenantUser($alice)
            ->patchJson("/api/v1/hr/performance/key-results/{$kr}", ['current_value' => 1])
            ->assertOk();
        $this->actingAsTenantUser($hr)
            ->patchJson("/api/v1/hr/performance/objectives/{$objective['id']}", ['status' => 'completed'])
            ->assertOk();

        // Only manage may create objectives for someone else.
        $this->actingAsTenantUser($bob)
            ->postJson('/api/v1/hr/performance/objectives', [
                'title' => 'Sneaky', 'period' => '2026-Q3',
                'employee_id' => $aliceEmp->id,
                'key_results' => [['title' => 'x', 'target_value' => 1]],
            ])
            ->assertForbidden();
        $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/hr/performance/objectives', [
                'title' => 'Assigned by HR', 'period' => '2026-Q3',
                'employee_id' => $aliceEmp->id,
                'key_results' => [['title' => 'Done', 'target_value' => 1]],
            ])
            ->assertCreated()
            ->assertJsonPath('data.employee_id', $aliceEmp->id);
    }
}
