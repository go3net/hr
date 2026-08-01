<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Anthropic Claude API
    |--------------------------------------------------------------------------
    | The assistant is disabled until an API key is configured. Model choices
    | follow the platform defaults: the capable model answers user questions
    | and drafts documents; the fast model is reserved for cheap internal
    | routing tasks as they appear.
    */

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'base_url' => env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
        'version' => '2023-06-01',
    ],

    'models' => [
        'capable' => env('AI_MODEL_CAPABLE', 'claude-opus-5'),
        'fast' => env('AI_MODEL_FAST', 'claude-haiku-4-5'),
    ],

    'max_tokens' => (int) env('AI_MAX_TOKENS', 2048),

    // Hard cap on request → tool → request rounds per chat turn.
    'max_tool_rounds' => 6,
];
