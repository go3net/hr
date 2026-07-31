<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ticket extends Model
{
    use BelongsToTenant;

    public const STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];

    public const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

    public const CATEGORIES = ['it', 'hr', 'facilities', 'finance', 'other'];

    protected $fillable = [
        'tenant_id', 'number', 'subject', 'description', 'status', 'priority',
        'category', 'requester_id', 'assignee_id', 'resolved_at', 'closed_at',
    ];

    protected $attributes = ['status' => 'open', 'priority' => 'medium'];

    protected function casts(): array
    {
        return [
            'resolved_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    /** Next per-tenant ticket number (call inside a transaction). */
    public static function nextNumber(int $tenantId): string
    {
        $count = static::withoutGlobalScopes()->where('tenant_id', $tenantId)->lockForUpdate()->count();

        return sprintf('HD-%04d', $count + 1);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TicketComment::class);
    }
}
