<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class CalendarEvent extends Model
{
    use BelongsToTenant;

    public const KINDS = ['meeting', 'reminder', 'deadline', 'company'];

    public const RESPONSES = ['pending', 'accepted', 'declined'];

    protected $fillable = [
        'tenant_id', 'title', 'description', 'location',
        'starts_at', 'ends_at', 'all_day', 'kind', 'organizer_id',
    ];

    protected $attributes = ['kind' => 'meeting', 'all_day' => false];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'all_day' => 'boolean',
        ];
    }

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'organizer_id');
    }

    public function attendees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'event_attendees')
            ->withPivot('response')
            ->withTimestamps();
    }
}
