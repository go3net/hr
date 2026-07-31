<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            'dashboard.activity.view' => 'View activity feed',
            'hr.employees.view' => 'View employees',
            'hr.employees.view_sensitive' => 'View sensitive employee data',
            'hr.employees.manage' => 'Create and edit employees',
            'hr.departments.view' => 'View departments',
            'hr.departments.manage' => 'Manage departments',
            'hr.attendance.view' => 'View attendance records',
            'hr.leave.view' => 'View all leave requests',
            'hr.leave.approve' => 'Approve or reject leave',
            'hr.payroll.view' => 'View payroll',
            'hr.payroll.manage' => 'Run payroll',
            'settings.modules.manage' => 'Enable or disable modules',
            'settings.roles.manage' => 'Manage roles and permissions',
            'projects.view' => 'View projects',
            'projects.manage' => 'Create and manage projects',
        ];

        foreach ($permissions as $key => $label) {
            Permission::query()->updateOrCreate(['key' => $key], ['label' => $label]);
        }

        // System roles (tenant_id null) — available to every tenant.
        $roles = [
            'super_admin' => ['name' => 'Super Admin', 'permissions' => '*'],
            'ceo' => ['name' => 'CEO', 'permissions' => array_keys($permissions)],
            'hr_manager' => ['name' => 'HR Manager', 'permissions' => [
                'dashboard.activity.view',
                'hr.employees.view', 'hr.employees.view_sensitive', 'hr.employees.manage',
                'hr.departments.view', 'hr.departments.manage',
                'hr.attendance.view', 'hr.leave.view', 'hr.leave.approve',
                'hr.payroll.view', 'hr.payroll.manage',
            ]],
            'department_manager' => ['name' => 'Department Manager', 'permissions' => [
                'hr.employees.view', 'hr.departments.view', 'hr.attendance.view',
                'hr.leave.view', 'hr.leave.approve',
            ]],
            'finance' => ['name' => 'Finance', 'permissions' => [
                'hr.employees.view', 'hr.payroll.view', 'hr.payroll.manage',
            ]],
            'project_manager' => ['name' => 'Project Manager', 'permissions' => ['hr.employees.view', 'projects.view', 'projects.manage']],
            'team_lead' => ['name' => 'Team Lead', 'permissions' => ['hr.employees.view', 'hr.leave.approve', 'projects.view', 'projects.manage']],
            'employee' => ['name' => 'Employee', 'permissions' => ['projects.view']],
            'nysc' => ['name' => 'NYSC Corps Member', 'permissions' => ['projects.view']],
            'intern' => ['name' => 'Intern', 'permissions' => ['projects.view']],
            'guest' => ['name' => 'Guest', 'permissions' => []],
        ];

        foreach ($roles as $key => $config) {
            $role = Role::query()->updateOrCreate(
                ['tenant_id' => null, 'key' => $key],
                ['name' => $config['name'], 'is_system' => true],
            );

            if ($config['permissions'] === '*') {
                continue; // super_admin bypasses permission checks entirely
            }

            $ids = Permission::query()->whereIn('key', $config['permissions'])->pluck('id');
            $role->permissions()->sync($ids);
        }
    }
}
