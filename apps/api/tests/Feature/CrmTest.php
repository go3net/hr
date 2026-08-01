<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class CrmTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpUsers(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $manager = $this->createUserWithRole($tenant, 'team_lead'); // crm.manage
        $employee = $this->createUserWithRole($tenant, 'employee'); // no crm access

        return [$tenant, $manager, $employee];
    }

    public function test_lead_converts_to_client_with_a_first_deal(): void
    {
        [, $manager] = $this->setUpUsers();

        $leadId = $this->actingAsTenantUser($manager)
            ->postJson('/api/v1/crm/leads', [
                'name' => 'Lagos MetroWorks',
                'company' => 'MetroWorks Ltd',
                'email' => 'ops@metroworks.ng',
                'source' => 'referral',
            ])
            ->assertCreated()
            ->json('data.id');

        $converted = $this->actingAsTenantUser($manager)
            ->postJson("/api/v1/crm/leads/{$leadId}/convert", [
                'deal_title' => 'Fleet onboarding',
                'deal_value' => 12_400_000,
            ])
            ->assertCreated()
            ->json('data');

        $this->assertNotNull($converted['client_id']);
        $this->assertNotNull($converted['deal_id']);

        // Converted leads cannot convert twice.
        $this->actingAsTenantUser($manager)
            ->postJson("/api/v1/crm/leads/{$leadId}/convert")
            ->assertUnprocessable();

        // The client carries the pipeline value.
        $clients = $this->actingAsTenantUser($manager)->getJson('/api/v1/crm/clients')->json('data');
        $this->assertSame('Lagos MetroWorks', $clients[0]['name']);
        $this->assertEquals(12_400_000, $clients[0]['pipeline_value']);
    }

    public function test_deal_stage_moves_update_stats_and_stamp_close(): void
    {
        [, $manager] = $this->setUpUsers();

        $deal = $this->actingAsTenantUser($manager)
            ->postJson('/api/v1/crm/deals', ['title' => 'Website retainer', 'value' => 2_000_000])
            ->assertCreated()
            ->json('data');

        $this->assertSame('qualification', $deal['stage']);

        $this->actingAsTenantUser($manager)
            ->patchJson("/api/v1/crm/deals/{$deal['id']}", ['stage' => 'negotiation', 'position' => 1])
            ->assertOk()
            ->assertJsonPath('data.stage', 'negotiation');

        $won = $this->actingAsTenantUser($manager)
            ->patchJson("/api/v1/crm/deals/{$deal['id']}", ['stage' => 'won'])
            ->assertOk()
            ->json('data');
        $this->assertNotNull($won['closed_at']);

        $response = $this->actingAsTenantUser($manager)->getJson('/api/v1/crm/deals')->assertOk();
        $stats = $response->json('meta.stats');
        $this->assertSame(1, $stats['won']['count']);
        $this->assertEquals(2_000_000, $stats['won']['value']);
        $this->assertSame(0, $stats['qualification']['count']);
    }

    public function test_activities_attach_to_deals_with_follow_ups(): void
    {
        [, $manager] = $this->setUpUsers();

        $deal = $this->actingAsTenantUser($manager)
            ->postJson('/api/v1/crm/deals', ['title' => 'Support contract'])
            ->json('data');

        $this->actingAsTenantUser($manager)
            ->postJson('/api/v1/crm/activities', [
                'deal_id' => $deal['id'],
                'kind' => 'call',
                'body' => 'Spoke with procurement — decision expected next week.',
                'follow_up_at' => now()->addWeek()->toDateString(),
            ])
            ->assertCreated();

        $activities = $this->actingAsTenantUser($manager)
            ->getJson("/api/v1/crm/activities?deal_id={$deal['id']}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $activities);
        $this->assertSame('call', $activities[0]['kind']);
        $this->assertNotNull($activities[0]['follow_up_at']);
    }

    public function test_employees_without_crm_permission_are_denied(): void
    {
        [, , $employee] = $this->setUpUsers();

        $this->actingAsTenantUser($employee)->getJson('/api/v1/crm/deals')->assertForbidden();
        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/crm/leads', ['name' => 'Nope'])
            ->assertForbidden();
    }
}
