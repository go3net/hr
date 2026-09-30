<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeDocument extends Model
{
    use BelongsToTenant;

    /** What HR actually asks for, plus somewhere to put the rest. */
    public const TYPES = [
        'id_card' => 'ID card',
        'passport_photo' => 'Passport photograph',
        'certificate' => 'Certificate',
        'cv' => 'CV / résumé',
        'contract' => 'Signed contract',
        'reference' => 'Reference letter',
        'medical' => 'Medical report',
        'other' => 'Other',
    ];

    protected $fillable = [
        'tenant_id', 'employee_id', 'type', 'name', 'path', 'mime', 'size_bytes', 'expires_on', 'uploaded_by',
    ];

    protected function casts(): array
    {
        return ['expires_on' => 'date'];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
