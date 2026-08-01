<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Module extends Model
{
    protected $fillable = ['key', 'name', 'description', 'is_core', 'sort_order'];

    protected function casts(): array
    {
        return ['is_core' => 'boolean'];
    }
}
