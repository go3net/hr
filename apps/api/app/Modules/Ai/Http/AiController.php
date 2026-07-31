<?php

namespace App\Modules\Ai\Http;

use App\Core\Http\ApiController;
use App\Modules\Ai\Services\AiGateway;
use App\Modules\Ai\Services\AiToolbox;
use App\Modules\Ai\Services\AiUpstreamException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiController extends ApiController
{
    public function __construct(
        private readonly AiGateway $gateway,
        private readonly AiToolbox $toolbox,
    ) {
    }

    /** Whether the assistant is usable, and which tools this user gets. */
    public function status(Request $request): JsonResponse
    {
        return $this->respond([
            'configured' => $this->gateway->isConfigured(),
            'model' => (string) config('ai.models.capable'),
            'tools' => collect($this->toolbox->definitionsFor($request->user()))
                ->pluck('name')
                ->all(),
        ]);
    }

    public function chat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:30'],
            'messages.*.role' => ['required', 'in:user,assistant'],
            'messages.*.content' => ['required', 'string', 'max:8000'],
        ]);

        if (! $this->gateway->isConfigured()) {
            return $this->respondError(
                'AI_NOT_CONFIGURED',
                'The AI assistant is not configured. Add ANTHROPIC_API_KEY to the API environment to enable it.',
                503,
            );
        }

        try {
            return $this->respond($this->gateway->chat($request->user(), $data['messages']));
        } catch (AiUpstreamException $e) {
            return $this->respondError('AI_UPSTREAM', $e->getMessage(), 502);
        }
    }

    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:offer_letter,contract,policy,memo,email,other'],
            'instructions' => ['required', 'string', 'max:8000'],
        ]);

        if (! $this->gateway->isConfigured()) {
            return $this->respondError(
                'AI_NOT_CONFIGURED',
                'The AI assistant is not configured. Add ANTHROPIC_API_KEY to the API environment to enable it.',
                503,
            );
        }

        try {
            return $this->respond($this->gateway->generate($request->user(), $data['type'], $data['instructions']));
        } catch (AiUpstreamException $e) {
            return $this->respondError('AI_UPSTREAM', $e->getMessage(), 502);
        }
    }
}
