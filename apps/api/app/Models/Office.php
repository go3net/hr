<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Office extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'name', 'address', 'latitude', 'longitude', 'geofence_radius_m', 'qr_secret',
    ];

    protected $hidden = ['qr_secret'];

    protected function casts(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Office $office) {
            $office->qr_secret ??= Str::random(40);
        });
    }

    /**
     * Rotating QR token: HMAC of the current 5-minute window. Codes shown
     * on the office display expire quickly, so screenshots don't spread.
     */
    public function currentQrToken(): string
    {
        $window = intdiv(now()->getTimestamp(), 300);

        return hash_hmac('sha256', "office:{$this->id}:{$window}", (string) $this->qr_secret);
    }

    public function verifyQrToken(string $token): bool
    {
        $now = intdiv(now()->getTimestamp(), 300);

        // Accept the current and previous window to tolerate clock edges.
        foreach ([$now, $now - 1] as $window) {
            $expected = hash_hmac('sha256', "office:{$this->id}:{$window}", (string) $this->qr_secret);
            if (hash_equals($expected, $token)) {
                return true;
            }
        }

        return false;
    }

    /** Distance in meters from this office to the given point (haversine). */
    public function distanceFrom(float $lat, float $lng): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat - $this->latitude);
        $dLng = deg2rad($lng - $this->longitude);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($this->latitude)) * cos(deg2rad($lat)) * sin($dLng / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
