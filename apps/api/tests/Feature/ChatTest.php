<?php

namespace Tests\Feature;

use App\Modules\Chat\Events\MessageSent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    private function setUpUsers(): array
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $alice = $this->createUserWithRole($tenant, 'employee', ['name' => 'Alice']);
        $bob = $this->createUserWithRole($tenant, 'employee', ['name' => 'Bob']);
        $carol = $this->createUserWithRole($tenant, 'employee', ['name' => 'Carol']);

        return [$tenant, $alice, $bob, $carol];
    }

    public function test_direct_conversations_dedupe(): void
    {
        [, $alice, $bob] = $this->setUpUsers();

        $first = $this->actingAsTenantUser($alice)
            ->postJson('/api/v1/chat/conversations', ['type' => 'direct', 'user_ids' => [$bob->id]])
            ->assertCreated()
            ->json('data');

        // Bob starting a chat with Alice lands in the same conversation.
        $second = $this->actingAsTenantUser($bob)
            ->postJson('/api/v1/chat/conversations', ['type' => 'direct', 'user_ids' => [$alice->id]])
            ->assertOk()
            ->json('data');

        $this->assertSame($first['id'], $second['id']);
        $this->assertTrue($second['existing']);
    }

    public function test_messaging_updates_unread_counts_and_read_clears_them(): void
    {
        [, $alice, $bob] = $this->setUpUsers();

        $id = $this->actingAsTenantUser($alice)
            ->postJson('/api/v1/chat/conversations', ['type' => 'direct', 'user_ids' => [$bob->id]])
            ->json('data.id');

        $this->actingAsTenantUser($alice)
            ->postJson("/api/v1/chat/conversations/{$id}/messages", ['body' => 'Morning Bob — standup in 10.'])
            ->assertCreated();

        // Bob sees one unread; Alice (the sender) sees none.
        $bobList = $this->actingAsTenantUser($bob)->getJson('/api/v1/chat/conversations')->json('data');
        $this->assertSame(1, $bobList[0]['unread']);
        $this->assertSame('Alice', $bobList[0]['name']);
        $this->assertStringContainsString('standup', $bobList[0]['last_message']['body']);

        $aliceList = $this->actingAsTenantUser($alice)->getJson('/api/v1/chat/conversations')->json('data');
        $this->assertSame(0, $aliceList[0]['unread']);

        $this->actingAsTenantUser($bob)->postJson("/api/v1/chat/conversations/{$id}/read")->assertOk();
        $bobAfter = $this->actingAsTenantUser($bob)->getJson('/api/v1/chat/conversations')->json('data');
        $this->assertSame(0, $bobAfter[0]['unread']);
    }

    public function test_non_participants_cannot_read_or_send(): void
    {
        [, $alice, $bob, $carol] = $this->setUpUsers();

        $id = $this->actingAsTenantUser($alice)
            ->postJson('/api/v1/chat/conversations', ['type' => 'direct', 'user_ids' => [$bob->id]])
            ->json('data.id');

        $this->actingAsTenantUser($carol)
            ->getJson("/api/v1/chat/conversations/{$id}/messages")
            ->assertNotFound();

        $this->actingAsTenantUser($carol)
            ->postJson("/api/v1/chat/conversations/{$id}/messages", ['body' => 'sneaky'])
            ->assertNotFound();
    }

    public function test_group_chat_and_broadcast_event(): void
    {
        Event::fake([MessageSent::class]);
        [, $alice, $bob, $carol] = $this->setUpUsers();

        $id = $this->actingAsTenantUser($alice)
            ->postJson('/api/v1/chat/conversations', [
                'type' => 'group',
                'name' => 'Launch crew',
                'user_ids' => [$bob->id, $carol->id],
            ])
            ->assertCreated()
            ->json('data.id');

        $this->actingAsTenantUser($bob)
            ->postJson("/api/v1/chat/conversations/{$id}/messages", ['body' => 'Deck is ready 🚀'])
            ->assertCreated();

        Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($id) {
            return $event->message->conversation_id === $id
                && str_contains($event->broadcastOn()->name, "conversation.{$id}");
        });

        $messages = $this->actingAsTenantUser($carol)
            ->getJson("/api/v1/chat/conversations/{$id}/messages")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $messages);
        $this->assertSame('Bob', $messages[0]['author']);
    }
}
