<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmActivity extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'deal_id', 'client_id', 'user_id', 'kind', 'body', 'follow_up_at'];

    protected function casts(): array
    {
        return ['follow_up_at' => 'datetime'];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
