<?php

namespace Tests\Feature;

use App\Core\Notifications\TicketReplied;
use App\Core\Notifications\TicketSubmitted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class HelpdeskTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_ticket_lifecycle_with_numbering_assignment_and_notifications(): void
    {
        Notification::fake();

        $this->seedCatalog();
        $tenant = $this->createTenant();
        $agent = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->createUserWithRole($tenant, 'employee');

        $ticket = $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/helpdesk/tickets', [
                'subject' => 'Laptop will not boot',
                'description' => 'Screen stays black after the Windows update.',
                'priority' => 'high',
                'category' => 'it',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('HD-0001', $ticket['number']);
        $this->assertSame('open', $ticket['status']);
        Notification::assertSentTo($agent, TicketSubmitted::class);

        // Agent takes it, moves it along.
        $this->actingAsTenantUser($agent)
            ->patchJson("/api/v1/helpdesk/tickets/{$ticket['id']}", [
                'assignee_id' => $agent->id,
                'status' => 'in_progress',
            ])
            ->assertOk()
            ->assertJsonPath('data.assignee', $agent->name)
            ->assertJsonPath('data.status', 'in_progress');

        // Agent reply notifies the requester; internal note stays hidden.
        $this->actingAsTenantUser($agent)
            ->postJson("/api/v1/helpdesk/tickets/{$ticket['id']}/comments", [
                'body' => 'Please try holding power for 10 seconds.',
            ])
            ->assertCreated();
        Notification::assertSentTo($employee, TicketReplied::class);

        $this->actingAsTenantUser($agent)
            ->postJson("/api/v1/helpdesk/tickets/{$ticket['id']}/comments", [
                'body' => 'Suspect the SSD, check warranty.', 'is_internal' => true,
            ])
            ->assertCreated();

        $asEmployee = $this->actingAsTenantUser($employee)
            ->getJson("/api/v1/helpdesk/tickets/{$ticket['id']}")
            ->json('data');
        $this->assertCount(1, $asEmployee['comments']);

        $asAgent = $this->actingAsTenantUser($agent)
            ->getJson("/api/v1/helpdesk/tickets/{$ticket['id']}")
            ->json('data');
        $this->assertCount(2, $asAgent['comments']);

        // Resolve stamps resolved_at.
        $resolved = $this->actingAsTenantUser($agent)
            ->patchJson("/api/v1/helpdesk/tickets/{$ticket['id']}", ['status' => 'resolved'])
            ->json('data');
        $this->assertSame('resolved', $resolved['status']);

        // A second ticket gets the next number.
        $second = $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/helpdesk/tickets', [
                'subject' => 'VPN keeps dropping', 'description' => 'Every ~10 minutes.',
            ])
            ->json('data');
        $this->assertSame('HD-0002', $second['number']);
    }

    public function test_requesters_see_only_their_own_tickets_but_may_close_them(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $agent = $this->createUserWithRole($tenant, 'hr_manager');
        $alice = $this->createUserWithRole($tenant, 'employee');
        $bob = $this->createUserWithRole($tenant, 'employee');

        $aliceTicket = $this->actingAsTenantUser($alice)
            ->postJson('/api/v1/helpdesk/tickets', ['subject' => 'Chair broken', 'description' => 'Left wheel missing.'])
            ->json('data');

        // Bob can't see or list Alice's ticket.
        $this->actingAsTenantUser($bob)->getJson("/api/v1/helpdesk/tickets/{$aliceTicket['id']}")->assertForbidden();
        $bobList = $this->actingAsTenantUser($bob)->getJson('/api/v1/helpdesk/tickets')->json();
        $this->assertCount(0, $bobList['data']);
        $this->assertFalse($bobList['meta']['is_agent']);

        // Bob can't change someone else's ticket; Alice can't reprioritise but may close her own.
        $this->actingAsTenantUser($bob)
            ->patchJson("/api/v1/helpdesk/tickets/{$aliceTicket['id']}", ['status' => 'closed'])
            ->assertForbidden();
        $this->actingAsTenantUser($alice)
            ->patchJson("/api/v1/helpdesk/tickets/{$aliceTicket['id']}", ['priority' => 'urgent'])
            ->assertForbidden();
        $this->actingAsTenantUser($alice)
            ->patchJson("/api/v1/helpdesk/tickets/{$aliceTicket['id']}", ['status' => 'closed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'closed');

        // The agent sees everything.
        $agentList = $this->actingAsTenantUser($agent)->getJson('/api/v1/helpdesk/tickets')->json();
        $this->assertCount(1, $agentList['data']);
        $this->assertTrue($agentList['meta']['is_agent']);
    }
}
