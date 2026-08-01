<?php

namespace App\Modules\Ai\Services;

use RuntimeException;

class AiUpstreamException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status)
    {
        parent::__construct($message);
    }
}
