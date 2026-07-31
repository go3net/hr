<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeDocument extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'employee_id', 'type', 'name', 'path', 'size_bytes', 'uploaded_by'];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
