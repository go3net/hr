<?php

namespace Database\Seeders;

use App\Core\Tenancy\TenantContext;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveType;
use App\Models\Office;
use App\Models\Position;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkSchedule;
use Illuminate\Database\Seeder;

class DemoTenantSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->firstOrCreate(
            ['subdomain' => 'go3net'],
            ['name' => 'Go3net Technologies Ltd', 'status' => 'active'],
        );

        $tenant->enableAllModules();
        app(TenantContext::class)->set($tenant);

        $admin = User::query()->firstOrCreate(
            ['email' => 'admin@go3net.com'],
            ['tenant_id' => $tenant->id, 'name' => 'Adaeze Okafor', 'password' => 'password'],
        );

        $superAdmin = Role::query()->whereNull('tenant_id')->where('key', 'super_admin')->first();
        if ($superAdmin) {
            $admin->roles()->syncWithoutDetaching([$superAdmin->id]);
        }

        $schedule = WorkSchedule::query()->firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Standard 9–5'],
            ['starts_at' => '09:00', 'ends_at' => '17:00', 'grace_minutes' => 15, 'work_days' => [1, 2, 3, 4, 5]],
        );

        Office::query()->firstOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Head Office'],
            [
                'address' => 'Victoria Island, Lagos',
                'latitude' => 6.4281, 'longitude' => 3.4219,
                'geofence_radius_m' => 150,
            ],
        );

        foreach (['Annual' => 20, 'Sick' => 10, 'Compassionate' => 5, 'Study' => 5, 'Maternity' => 84, 'Paternity' => 10] as $name => $days) {
            LeaveType::query()->firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $name],
                ['days_per_year' => $days],
            );
        }

        $departments = [];
        foreach (['Engineering', 'People Ops', 'Finance', 'Sales', 'Design', 'Operations'] as $name) {
            $departments[$name] = Department::query()->firstOrCreate(['tenant_id' => $tenant->id, 'name' => $name]);
        }

        $positions = [];
        foreach ([['Engineering Lead', 'Engineering'], ['HR Manager', 'People Ops'], ['Finance Officer', 'Finance'], ['Backend Engineer', 'Engineering'], ['Product Designer', 'Design']] as [$title, $dept]) {
            $positions[$title] = Position::query()->firstOrCreate(
                ['tenant_id' => $tenant->id, 'title' => $title],
                ['department_id' => $departments[$dept]->id],
            );
        }

        $staff = [
            ['G3N-001', 'Adaeze', 'Okafor', 'Engineering', 'Engineering Lead', $admin->id, 850_000],
            ['G3N-002', 'Tunde', 'Bakare', 'People Ops', 'HR Manager', null, 650_000],
            ['G3N-003', 'Grace', 'Eze', 'Finance', 'Finance Officer', null, 500_000],
            ['G3N-004', 'Emeka', 'Nwosu', 'Engineering', 'Backend Engineer', null, 550_000],
            ['G3N-005', 'Fatima', 'Bello', 'Design', 'Product Designer', null, 480_000],
        ];

        foreach ($staff as [$code, $first, $last, $dept, $position, $userId, $salary]) {
            Employee::query()->firstOrCreate(
                ['tenant_id' => $tenant->id, 'employee_code' => $code],
                [
                    'user_id' => $userId,
                    'first_name' => $first,
                    'last_name' => $last,
                    'email' => strtolower($first).'@go3net.com',
                    'department_id' => $departments[$dept]->id,
                    'position_id' => $positions[$position]->id,
                    'work_schedule_id' => $schedule->id,
                    'employment_type' => 'full_time',
                    'hired_at' => now()->subMonths(rand(3, 30))->toDateString(),
                    'status' => 'active',
                    'base_salary' => $salary,
                    'allowances' => [
                        'housing' => (int) round($salary * 0.15),
                        'transport' => (int) round($salary * 0.10),
                    ],
                ],
            );
        }
    }
}
