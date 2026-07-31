<?php

namespace App\Models;

use App\Core\Tenancy\BelongsToTenant;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Employee extends Model
{
    use BelongsToTenant, HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'user_id', 'department_id', 'position_id', 'manager_id', 'work_schedule_id',
        'employee_code', 'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender',
        'marital_status', 'address', 'photo_path', 'nin', 'bvn', 'bank_name', 'bank_account_number',
        'pension_pin', 'medical_notes', 'employment_type', 'hired_at', 'status', 'base_salary', 'allowances',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'hired_at' => 'date',
            'base_salary' => 'decimal:2',
            'allowances' => 'array',
            // Sensitive identity & payment data: encrypted at rest.
            'nin' => 'encrypted',
            'bvn' => 'encrypted',
            'bank_name' => 'encrypted',
            'bank_account_number' => 'encrypted',
            'pension_pin' => 'encrypted',
            'medical_notes' => 'encrypted',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Employee $employee) {
            $employee->public_id ??= (string) Str::uuid();
        });
    }

    protected function fullName(): Attribute
    {
        return Attribute::get(fn () => trim("{$this->first_name} {$this->last_name}"));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function manager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'manager_id');
    }

    public function workSchedule(): BelongsTo
    {
        return $this->belongsTo(WorkSchedule::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(EmployeeDocument::class);
    }

    public function emergencyContacts(): HasMany
    {
        return $this->hasMany(EmergencyContact::class);
    }

    public function guarantors(): HasMany
    {
        return $this->hasMany(Guarantor::class);
    }

    public function employmentEvents(): HasMany
    {
        return $this->hasMany(EmploymentEvent::class);
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class);
    }

    public function leaveRequests(): HasMany
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function leaveBalances(): HasMany
    {
        return $this->hasMany(LeaveBalance::class);
    }
}
