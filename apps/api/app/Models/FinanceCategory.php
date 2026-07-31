<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class FinanceCategory extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'name', 'kind'];
}
