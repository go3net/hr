<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'folder_id', 'name', 'path', 'mime', 'size_bytes', 'visibility', 'uploaded_by',
    ];

    public function folder(): BelongsTo
    {
        return $this->belongsTo(Folder::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function sharedWith(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'document_shares');
    }

    /** Documents this user may see: tenant-wide, own, or explicitly shared. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where('visibility', 'tenant')
            ->orWhere('uploaded_by', $user->id)
            ->orWhereHas('sharedWith', fn (Builder $s) => $s->where('users.id', $user->id)));
    }

    public function isAccessibleBy(User $user): bool
    {
        return $this->visibility === 'tenant'
            || $this->uploaded_by === $user->id
            || $this->sharedWith()->where('users.id', $user->id)->exists();
    }
}
