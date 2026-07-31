<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollItem extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'payroll_run_id', 'employee_id', 'basic', 'allowances', 'bonuses', 'deductions',
        'gross', 'pension_employee', 'pension_employer', 'paye_tax', 'net', 'payslip_path',
    ];

    protected function casts(): array
    {
        return [
            'basic' => 'decimal:2',
            'allowances' => 'array',
            'bonuses' => 'array',
            'deductions' => 'array',
            'gross' => 'decimal:2',
            'pension_employee' => 'decimal:2',
            'pension_employer' => 'decimal:2',
            'paye_tax' => 'decimal:2',
            'net' => 'decimal:2',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
