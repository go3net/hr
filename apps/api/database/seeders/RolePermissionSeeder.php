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
            'hr.team.view' => 'View your direct reports',
            'hr.leave.view' => 'View all leave requests',
            'hr.leave.approve' => 'Approve or reject leave',
            'hr.payroll.view' => 'View payroll',
            'hr.payroll.manage' => 'Run payroll',
            'settings.modules.manage' => 'Enable or disable modules',
            'settings.roles.manage' => 'Manage roles and permissions',
            'settings.billing.manage' => 'Manage billing and subscription',
            'settings.branding.manage' => 'Manage workspace branding',
            'projects.view' => 'View projects',
            'projects.manage' => 'Create and manage projects',
            'documents.manage' => 'Manage any document or folder',
            'crm.view' => 'View CRM data',
            'crm.manage' => 'Manage leads, clients and deals',
            'finance.view' => 'View finance data',
            'finance.manage' => 'Manage transactions and invoices',
            'helpdesk.manage' => 'Manage help desk tickets',
            'knowledge.manage' => 'Author knowledge base articles',
            'calendar.manage' => 'Create company-wide calendar events',
            'hr.recruitment.manage' => 'Manage job openings and applicants',
            'hr.assets.manage' => 'Manage company assets and assignments',
            'inventory.view' => 'View inventory',
            'inventory.manage' => 'Manage inventory items and stock',
            'lms.manage' => 'Author and publish courses',
            'hr.performance.view' => 'View all performance objectives',
            'hr.performance.manage' => 'Manage objectives for any employee',
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
                'hr.attendance.view', 'hr.leave.view', 'hr.leave.approve', 'hr.team.view',
                'hr.payroll.view', 'hr.payroll.manage', 'documents.manage',
                'helpdesk.manage', 'knowledge.manage', 'calendar.manage',
                'hr.recruitment.manage', 'hr.performance.view', 'hr.performance.manage',
                'lms.manage', 'hr.assets.manage',
            ]],
            'department_manager' => ['name' => 'Department Manager', 'permissions' => [
                'hr.employees.view', 'hr.departments.view', 'hr.attendance.view',
                'hr.leave.view', 'hr.leave.approve', 'crm.view', 'crm.manage',
                'hr.performance.view', 'hr.team.view',
            ]],
            'finance' => ['name' => 'Finance', 'permissions' => [
                'hr.employees.view', 'hr.payroll.view', 'hr.payroll.manage', 'crm.view',
                'finance.view', 'finance.manage', 'inventory.view', 'inventory.manage',
            ]],
            'project_manager' => ['name' => 'Project Manager', 'permissions' => ['hr.employees.view', 'projects.view', 'projects.manage', 'crm.view', 'crm.manage']],
            'team_lead' => ['name' => 'Team Lead', 'permissions' => [
                'hr.employees.view', 'hr.team.view', 'hr.attendance.view',
                'hr.leave.view', 'hr.leave.approve',
                'projects.view', 'projects.manage', 'crm.view', 'crm.manage',
            ]],
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
