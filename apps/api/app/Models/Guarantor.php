<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Guarantor extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'employee_id', 'name', 'occupation', 'phone', 'address'];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
