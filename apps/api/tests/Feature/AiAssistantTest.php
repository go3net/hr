<?php

namespace Tests\Feature;

use App\Models\AiUsageLog;
use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\InteractsWithTenancy;
use Tests\TestCase;

class AiAssistantTest extends TestCase
{
    use InteractsWithTenancy, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['ai.anthropic.key' => 'test-key']);
    }

    private function apiUrl(): string
    {
        return rtrim((string) config('ai.anthropic.base_url'), '/').'/v1/messages';
    }

    public function test_chat_runs_tool_loop_and_logs_usage(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        Employee::create([
            'tenant_id' => $tenant->id,
            'employee_code' => 'G3N-001',
            'first_name' => 'Amina',
            'last_name' => 'Bello',
            'email' => 'amina@example.com',
            'employment_type' => 'full_time',
            'status' => 'active',
            'hired_at' => now()->subYear(),
        ]);

        Http::fakeSequence($this->apiUrl())
            ->push([
                'content' => [
                    ['type' => 'tool_use', 'id' => 'toolu_01', 'name' => 'search_employees', 'input' => ['query' => 'Amina']],
                ],
                'stop_reason' => 'tool_use',
                'usage' => ['input_tokens' => 400, 'output_tokens' => 50],
            ])
            ->push([
                'content' => [
                    ['type' => 'text', 'text' => 'Amina Bello is an active full-time employee (G3N-001).'],
                ],
                'stop_reason' => 'end_turn',
                'usage' => ['input_tokens' => 600, 'output_tokens' => 80],
            ]);

        $response = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/ai/chat', [
                'messages' => [['role' => 'user', 'content' => 'Tell me about Amina']],
            ])
            ->assertOk()
            ->json('data');

        $this->assertStringContainsString('Amina Bello', $response['reply']);
        $this->assertSame(['search_employees'], $response['tool_calls']);
        $this->assertSame(1000, $response['usage']['input_tokens']);
        $this->assertSame(130, $response['usage']['output_tokens']);

        // The second request carried the executed tool result back to Claude.
        $toolResultRequests = collect(Http::recorded())
            ->filter(function (array $pair) {
                /** @var Request $request */
                $request = $pair[0];
                $last = collect($request->data()['messages'])->last();

                return is_array($last['content'] ?? null)
                    && ($last['content'][0]['type'] ?? null) === 'tool_result'
                    && $last['content'][0]['tool_use_id'] === 'toolu_01'
                    && str_contains($last['content'][0]['content'], 'Amina Bello');
            });
        $this->assertCount(1, $toolResultRequests);

        $log = AiUsageLog::withoutGlobalScopes()->where('tenant_id', $tenant->id)->sole();
        $this->assertSame('chat', $log->purpose);
        $this->assertSame(1000, $log->input_tokens);
        $this->assertSame(130, $log->output_tokens);
        $this->assertSame(1, $log->tool_calls);
    }

    public function test_tools_offered_match_user_permissions(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $employee = $this->createUserWithRole($tenant, 'employee');
        $finance = $this->createUserWithRole($tenant, 'finance');

        // The employee role only holds projects.view.
        $tools = $this->actingAsTenantUser($employee)->getJson('/api/v1/ai/status')->json('data.tools');
        $this->assertSame(['get_project_status'], $tools);

        $financeTools = $this->actingAsTenantUser($finance)->getJson('/api/v1/ai/status')->json('data.tools');
        $this->assertContains('get_finance_summary', $financeTools);
        $this->assertContains('search_employees', $financeTools);
        $this->assertNotContains('get_leave_summary', $financeTools);
    }

    public function test_chat_returns_503_when_not_configured(): void
    {
        config(['ai.anthropic.key' => null]);

        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/ai/chat', [
                'messages' => [['role' => 'user', 'content' => 'Hello']],
            ])
            ->assertStatus(503)
            ->assertJsonPath('error.code', 'AI_NOT_CONFIGURED');

        $status = $this->actingAsTenantUser($user)->getJson('/api/v1/ai/status')->json('data');
        $this->assertFalse($status['configured']);
    }

    public function test_generate_produces_document_and_logs_usage(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $hr = $this->createUserWithRole($tenant, 'hr_manager');

        Http::fake([
            $this->apiUrl() => Http::response([
                'content' => [['type' => 'text', 'text' => "# Offer Letter\n\nDear [CANDIDATE NAME], …"]],
                'stop_reason' => 'end_turn',
                'usage' => ['input_tokens' => 200, 'output_tokens' => 500],
            ]),
        ]);

        $response = $this->actingAsTenantUser($hr)
            ->postJson('/api/v1/ai/generate', [
                'type' => 'offer_letter',
                'instructions' => 'Offer letter for a Senior Engineer, ₦850,000 monthly, starting 1 September.',
            ])
            ->assertOk()
            ->json('data');

        $this->assertStringContainsString('Offer Letter', $response['content']);

        $log = AiUsageLog::withoutGlobalScopes()->where('tenant_id', $tenant->id)->sole();
        $this->assertSame('generate', $log->purpose);
        $this->assertSame(500, $log->output_tokens);
    }

    public function test_upstream_error_maps_to_502(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        Http::fake([
            $this->apiUrl() => Http::response([
                'error' => ['type' => 'overloaded_error', 'message' => 'Overloaded'],
            ], 529),
        ]);

        $this->actingAsTenantUser($user)
            ->postJson('/api/v1/ai/chat', [
                'messages' => [['role' => 'user', 'content' => 'Hello']],
            ])
            ->assertStatus(502)
            ->assertJsonPath('error.code', 'AI_UPSTREAM');
    }

    public function test_ai_module_can_be_disabled(): void
    {
        $this->seedCatalog();
        $tenant = $this->createTenant();
        $user = $this->createUserWithRole($tenant, 'employee');

        $tenant->modules()->updateExistingPivot(
            \App\Models\Module::query()->where('key', 'ai')->value('id'),
            ['enabled' => false],
        );

        $this->actingAsTenantUser($user)
            ->getJson('/api/v1/ai/status')
            ->assertForbidden();
    }
}
