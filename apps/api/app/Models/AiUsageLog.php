<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiUsageLog extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'user_id', 'purpose', 'model',
        'input_tokens', 'output_tokens', 'tool_calls',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
