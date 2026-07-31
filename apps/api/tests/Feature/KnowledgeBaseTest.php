<?php

namespace Tests\Feature;

use App\Models\KbArticle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class KnowledgeBaseTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    public function test_draft_publish_flow_with_visibility_and_views(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $editor = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->createUserWithRole($tenant, 'employee');

        $article = $this->actingAsTenantUser($editor)
            ->postJson('/api/v1/knowledge/articles', [
                'title' => 'Annual Leave Policy',
                'category' => 'policies',
                'body' => "## Entitlement\nEvery full-time employee gets 20 working days per year.",
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('annual-leave-policy', $article['slug']);
        $this->assertSame('draft', $article['status']);

        // Drafts are invisible to regular staff — list and direct fetch.
        $this->assertCount(0, $this->actingAsTenantUser($employee)->getJson('/api/v1/knowledge/articles')->json('data'));
        $this->actingAsTenantUser($employee)->getJson("/api/v1/knowledge/articles/{$article['slug']}")->assertNotFound();

        // Editors still see their drafts in the list.
        $this->assertCount(1, $this->actingAsTenantUser($editor)->getJson('/api/v1/knowledge/articles')->json('data'));

        $this->actingAsTenantUser($editor)
            ->postJson("/api/v1/knowledge/articles/{$article['id']}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', 'published');

        // Published articles are readable and count views.
        $read = $this->actingAsTenantUser($employee)
            ->getJson("/api/v1/knowledge/articles/{$article['slug']}")
            ->assertOk()
            ->json('data');
        $this->assertStringContainsString('20 working days', $read['body']);
        $this->assertSame(1, KbArticle::withoutGlobalScopes()->find($article['id'])->views);

        // Search matches body text.
        $hits = $this->actingAsTenantUser($employee)
            ->getJson('/api/v1/knowledge/articles?q=full-time')
            ->json('data');
        $this->assertCount(1, $hits);

        // Duplicate titles get suffixed slugs.
        $dup = $this->actingAsTenantUser($editor)
            ->postJson('/api/v1/knowledge/articles', ['title' => 'Annual Leave Policy', 'body' => 'v2'])
            ->json('data');
        $this->assertSame('annual-leave-policy-2', $dup['slug']);
    }

    public function test_authoring_requires_permission(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($employee)
            ->postJson('/api/v1/knowledge/articles', ['title' => 'Nope', 'body' => 'x'])
            ->assertForbidden();
    }

    public function test_ai_toolbox_reads_published_articles_only(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $editor = $this->createUserWithRole($tenant, 'hr_manager');
        $employee = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($editor)->postJson('/api/v1/knowledge/articles', [
            'title' => 'Expense Reimbursement', 'body' => 'Submit receipts within 30 days.',
        ]);
        $published = $this->actingAsTenantUser($editor)->postJson('/api/v1/knowledge/articles', [
            'title' => 'Remote Work Guide', 'body' => 'Core hours are 10:00 to 16:00 WAT.',
        ])->json('data');
        $this->actingAsTenantUser($editor)->postJson("/api/v1/knowledge/articles/{$published['id']}/publish");

        $result = app(\App\Modules\Ai\Services\AiToolbox::class)
            ->execute($employee, 'search_knowledge_base', ['query' => 'core hours']);

        $this->assertSame(1, $result['count']);
        $this->assertSame('Remote Work Guide', $result['articles'][0]['title']);

        // The unpublished draft never surfaces, even on a direct match.
        $miss = app(\App\Modules\Ai\Services\AiToolbox::class)
            ->execute($employee, 'search_knowledge_base', ['query' => 'receipts']);
        $this->assertSame(0, $miss['count']);
    }
}
