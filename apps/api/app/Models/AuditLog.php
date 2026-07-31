<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'tenant_id', 'user_id', 'action', 'entity_type', 'entity_id', 'changes', 'ip', 'user_agent',
    ];

    protected function casts(): array
    {
        return ['changes' => 'array'];
    }

    /** Write an audit entry for the current request context. */
    public static function record(string $action, ?Model $entity = null, array $changes = []): self
    {
        $request = request();

        return static::create([
            'tenant_id' => app(\App\Core\Tenancy\TenantContext::class)->id(),
            'user_id' => $request?->user()?->id,
            'action' => $action,
            'entity_type' => $entity ? $entity::class : null,
            'entity_id' => $entity?->getKey(),
            'changes' => $changes ?: null,
            'ip' => $request?->ip(),
            'user_agent' => (string) $request?->userAgent(),
        ]);
    }
}
