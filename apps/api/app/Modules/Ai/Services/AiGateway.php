<?php

namespace App\Modules\Ai\Services;

use App\Models\AiUsageLog;
use App\Models\User;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Thin gateway over the Anthropic Messages API. Runs the agentic tool-use
 * loop for chat (request → execute tools → feed results back until Claude
 * produces text) and single-shot generation for documents, logging token
 * usage per turn for metering.
 */
class AiGateway
{
    public function __construct(private readonly AiToolbox $toolbox)
    {
    }

    public function isConfigured(): bool
    {
        return (string) config('ai.anthropic.key') !== '';
    }

    /**
     * Grounded chat over tenant data.
     *
     * @param  array<int, array{role: string, content: string}>  $history
     * @return array{reply: string, tool_calls: array<int, string>, usage: array{input_tokens: int, output_tokens: int}}
     */
    public function chat(User $user, array $history): array
    {
        $tools = $this->toolbox->definitionsFor($user);
        $messages = array_map(
            fn (array $m) => ['role' => $m['role'], 'content' => $m['content']],
            $history,
        );

        $inputTokens = 0;
        $outputTokens = 0;
        $toolCallNames = [];
        $reply = '';

        for ($round = 0; $round <= (int) config('ai.max_tool_rounds'); $round++) {
            $payload = [
                'model' => config('ai.models.capable'),
                'max_tokens' => (int) config('ai.max_tokens'),
                'system' => $this->chatSystemPrompt($user),
                'messages' => $messages,
            ];
            if ($tools !== []) {
                $payload['tools'] = $tools;
            }

            $data = $this->request($payload);
            $inputTokens += (int) ($data['usage']['input_tokens'] ?? 0);
            $outputTokens += (int) ($data['usage']['output_tokens'] ?? 0);

            $content = $data['content'] ?? [];
            $stopReason = $data['stop_reason'] ?? 'end_turn';

            if ($stopReason === 'refusal') {
                $reply = 'I can’t help with that request.';
                break;
            }

            if ($stopReason !== 'tool_use') {
                $reply = collect($content)
                    ->where('type', 'text')
                    ->pluck('text')
                    ->implode("\n");
                break;
            }

            // Execute every tool call and return all results in ONE user turn.
            $messages[] = ['role' => 'assistant', 'content' => $content];
            $results = [];
            foreach ($content as $block) {
                if (($block['type'] ?? null) !== 'tool_use') {
                    continue;
                }
                $toolCallNames[] = $block['name'];
                $result = $this->toolbox->execute($user, $block['name'], (array) ($block['input'] ?? []));
                $results[] = [
                    'type' => 'tool_result',
                    'tool_use_id' => $block['id'],
                    'content' => is_string($result) ? $result : json_encode($result),
                ];
            }
            $messages[] = ['role' => 'user', 'content' => $results];
        }

        $this->logUsage($user, 'chat', $inputTokens, $outputTokens, count($toolCallNames));

        return [
            'reply' => $reply !== '' ? $reply : 'I wasn’t able to finish that request — please try rephrasing it.',
            'tool_calls' => array_values(array_unique($toolCallNames)),
            'usage' => ['input_tokens' => $inputTokens, 'output_tokens' => $outputTokens],
        ];
    }

    /**
     * Single-shot document generation (offer letters, memos, policies…).
     *
     * @return array{content: string, usage: array{input_tokens: int, output_tokens: int}}
     */
    public function generate(User $user, string $type, string $instructions): array
    {
        $data = $this->request([
            'model' => config('ai.models.capable'),
            'max_tokens' => max((int) config('ai.max_tokens'), 4096),
            'system' => $this->generateSystemPrompt($user, $type),
            'messages' => [['role' => 'user', 'content' => $instructions]],
        ]);

        $inputTokens = (int) ($data['usage']['input_tokens'] ?? 0);
        $outputTokens = (int) ($data['usage']['output_tokens'] ?? 0);
        $this->logUsage($user, 'generate', $inputTokens, $outputTokens, 0);

        $content = ($data['stop_reason'] ?? null) === 'refusal'
            ? 'I can’t generate that document.'
            : collect($data['content'] ?? [])->where('type', 'text')->pluck('text')->implode("\n");

        return [
            'content' => $content,
            'usage' => ['input_tokens' => $inputTokens, 'output_tokens' => $outputTokens],
        ];
    }

    private function request(array $payload): array
    {
        $response = Http::withHeaders([
            'x-api-key' => config('ai.anthropic.key'),
            'anthropic-version' => config('ai.anthropic.version'),
        ])
            ->timeout(90)
            ->post(rtrim((string) config('ai.anthropic.base_url'), '/').'/v1/messages', $payload);

        return $this->parse($response);
    }

    private function parse(Response $response): array
    {
        if ($response->failed()) {
            $message = $response->json('error.message') ?? 'The AI service returned an error.';
            throw new AiUpstreamException($message, $response->status());
        }

        return $response->json();
    }

    private function chatSystemPrompt(User $user): string
    {
        $tenant = $user->tenant;

        return implode("\n", [
            "You are the Go3net Office assistant for {$tenant->name}, a workspace built by Go3net Technologies Ltd.",
            'Today is '.now()->toFormattedDayDateString().'. The workspace currency is Nigerian Naira (₦).',
            "The person you are helping is {$user->name}.",
            'Answer questions about the workspace using the provided tools — never invent employee names, figures or records.',
            'If the tools cannot answer the question, say so and suggest where in the app the person can look.',
            'Format amounts with the ₦ symbol and thousands separators. Keep answers concise and use Markdown lists or tables when they help.',
        ]);
    }

    private function generateSystemPrompt(User $user, string $type): string
    {
        $labels = [
            'offer_letter' => 'an employment offer letter',
            'contract' => 'an employment or service contract',
            'policy' => 'a company policy document',
            'memo' => 'an internal memo',
            'email' => 'a professional email',
            'other' => 'a business document',
        ];

        $tenantName = $user->tenant->name;

        return implode("\n", [
            "You are the document drafting assistant for {$tenantName} on Go3net Office.",
            'Draft '.($labels[$type] ?? $labels['other']).' in polished, professional English suitable for a Nigerian company.',
            'Return the document as clean Markdown. Use [PLACEHOLDER] markers for details the requester did not provide.',
            'Do not add commentary before or after the document — return only the document itself.',
        ]);
    }

    private function logUsage(User $user, string $purpose, int $in, int $out, int $toolCalls): void
    {
        AiUsageLog::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'purpose' => $purpose,
            'model' => (string) config('ai.models.capable'),
            'input_tokens' => $in,
            'output_tokens' => $out,
            'tool_calls' => $toolCalls,
        ]);
    }
}
