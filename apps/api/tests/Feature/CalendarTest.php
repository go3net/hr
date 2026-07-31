<?php

namespace Tests\Feature;

use App\Core\Notifications\EventInvited;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class CalendarTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_event_lifecycle_with_invites_and_rsvp(): void
    {
        Notification::fake();

        $this->seedCatalog();
        $tenant = $this->createTenant();
        $organizer = $this->createUserWithRole($tenant, 'employee');
        $invitee = $this->createUserWithRole($tenant, 'employee');
        $outsider = $this->createUserWithRole($tenant, 'employee');

        $event = $this->actingAsTenantUser($organizer)
            ->postJson('/api/v1/calendar/events', [
                'title' => 'Sprint planning',
                'location' => 'Boardroom',
                'starts_at' => now()->addDays(2)->setTime(10, 0)->toIso8601String(),
                'ends_at' => now()->addDays(2)->setTime(11, 0)->toIso8601String(),
                'attendee_ids' => [$invitee->id],
            ])
            ->assertCreated()
            ->json('data');

        $this->assertTrue($event['is_organizer']);
        Notification::assertSentTo($invitee, EventInvited::class);
        Notification::assertNotSentTo($outsider, EventInvited::class);

        $window = '?from='.now()->toDateString().'&to='.now()->addDays(7)->toDateString();

        // Organizer and invitee see it; the outsider doesn't.
        $this->assertCount(1, $this->actingAsTenantUser($organizer)->getJson("/api/v1/calendar/events{$window}")->json('data'));
        $asInvitee = $this->actingAsTenantUser($invitee)->getJson("/api/v1/calendar/events{$window}")->json('data');
        $this->assertCount(1, $asInvitee);
        $this->assertSame('pending', $asInvitee[0]['my_response']);
        $this->assertCount(0, $this->actingAsTenantUser($outsider)->getJson("/api/v1/calendar/events{$window}")->json('data'));

        // RSVP.
        $accepted = $this->actingAsTenantUser($invitee)
            ->postJson("/api/v1/calendar/events/{$event['id']}/respond", ['response' => 'accepted'])
            ->assertOk()
            ->json('data');
        $this->assertSame('accepted', $accepted['my_response']);

        $this->actingAsTenantUser($outsider)
            ->postJson("/api/v1/calendar/events/{$event['id']}/respond", ['response' => 'accepted'])
            ->assertForbidden();

        // Only the organizer edits or deletes.
        $this->actingAsTenantUser($invitee)
            ->patchJson("/api/v1/calendar/events/{$event['id']}", ['title' => 'Hijacked'])
            ->assertForbidden();
        $this->actingAsTenantUser($organizer)
            ->patchJson("/api/v1/calendar/events/{$event['id']}", ['title' => 'Sprint planning (moved)'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Sprint planning (moved)');
        $this->actingAsTenantUser($organizer)
            ->deleteJson("/api/v1/calendar/events/{$event['id']}")
            ->assertNoContent();
    }

    public function test_company_events_visible_to_all_but_gated_on_create(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->createUserWithRole($tenant, 'employee');

        // Regular staff can't create company-wide events.
        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/calendar/events', [
                'title' => 'Fake townhall', 'kind' => 'company',
                'starts_at' => now()->addDay()->toIso8601String(),
                'ends_at' => now()->addDay()->addHour()->toIso8601String(),
            ])
            ->assertForbidden();

        $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/calendar/events', [
                'title' => 'Quarterly townhall', 'kind' => 'company',
                'starts_at' => now()->addDay()->setTime(15, 0)->toIso8601String(),
                'ends_at' => now()->addDay()->setTime(16, 0)->toIso8601String(),
            ])
            ->assertCreated();

        // Everyone sees it without an invite.
        $window = '?from='.now()->toDateString().'&to='.now()->addDays(3)->toDateString();
        $seen = $this->actingAsTenantUser($employee)->getJson("/api/v1/calendar/events{$window}")->json('data');
        $this->assertCount(1, $seen);
        $this->assertSame('company', $seen[0]['kind']);
    }

    public function test_validation_and_ics_export(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        // End before start is rejected.
        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/calendar/events', [
                'title' => 'Backwards',
                'starts_at' => now()->addDay()->toIso8601String(),
                'ends_at' => now()->toIso8601String(),
            ])
            ->assertUnprocessable();

        $this->actingAsTenantUser($user)->postJson('/api/v1/calendar/events', [
            'title' => 'Board review; Q3, final',
            'starts_at' => now()->addDays(3)->setTime(9, 0)->toIso8601String(),
            'ends_at' => now()->addDays(3)->setTime(10, 30)->toIso8601String(),
        ])->assertCreated();

        $ics = $this->actingAsTenantUser($user)->get('/api/v1/calendar/export');
        $ics->assertOk()->assertHeader('Content-Type', 'text/calendar; charset=utf-8');
        $body = $ics->getContent();
        $this->assertStringContainsString('BEGIN:VEVENT', $body);
        $this->assertStringContainsString('SUMMARY:Board review\; Q3\, final', $body);
        $this->assertStringContainsString('END:VCALENDAR', $body);
    }

    public function test_events_are_tenant_isolated(): void
    {
        $this->seedCatalog();
        $tenantA = $this->createTenant();
        $tenantB = $this->createTenant('beta', 'Beta Ltd');
        $alice = $this->createUserWithRole($tenantA, 'hr_manager');
        $bob = $this->createUserWithRole($tenantB, 'hr_manager');

        $this->actingAsTenantUser($alice)->postJson('/api/v1/calendar/events', [
            'title' => 'Tenant A townhall', 'kind' => 'company',
            'starts_at' => now()->addDay()->toIso8601String(),
            'ends_at' => now()->addDay()->addHour()->toIso8601String(),
        ])->assertCreated();

        $window = '?from='.now()->toDateString().'&to='.now()->addDays(3)->toDateString();
        $this->assertCount(0, $this->actingAsTenantUser($bob)->getJson("/api/v1/calendar/events{$window}")->json('data'));
    }
}
