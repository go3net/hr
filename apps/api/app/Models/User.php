<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'tenant_id',
        'name',
        'email',
        'password',
        'status',
        'last_login_at',
        'provider',
        'provider_id',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_confirmed_at !== null && $this->two_factor_secret !== null;
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function employee(): HasOne
    {
        return $this->hasOne(Employee::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    /** Cached-per-request set of permission keys granted through roles. */
    public function permissionKeys(): array
    {
        return $this->permissionKeysCache ??= $this->roles()
            ->with('permissions:id,key')
            ->get()
            ->flatMap(fn (Role $role) => $role->permissions->pluck('key'))
            ->unique()
            ->values()
            ->all();
    }

    private ?array $permissionKeysCache = null;

    public function hasRole(string $key): bool
    {
        return $this->roles()->where('key', $key)->exists();
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->hasRole('super_admin')) {
            return true;
        }

        return in_array($permission, $this->permissionKeys(), true);
    }
}
