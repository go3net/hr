<?php

namespace Database\Seeders;

use App\Models\Module;
use Illuminate\Database\Seeder;

class ModuleSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            ['key' => 'dashboard', 'name' => 'Dashboard', 'is_core' => true],
            ['key' => 'hr', 'name' => 'Human Resources', 'is_core' => true],
            ['key' => 'projects', 'name' => 'Projects'],
            ['key' => 'tasks', 'name' => 'Tasks'],
            ['key' => 'crm', 'name' => 'CRM'],
            ['key' => 'finance', 'name' => 'Finance'],
            ['key' => 'inventory', 'name' => 'Inventory'],
            ['key' => 'lms', 'name' => 'Training & LMS'],
            ['key' => 'documents', 'name' => 'Documents'],
            ['key' => 'chat', 'name' => 'Chat'],
            ['key' => 'knowledge', 'name' => 'Knowledge Base'],
            ['key' => 'helpdesk', 'name' => 'Help Desk'],
            ['key' => 'calendar', 'name' => 'Calendar'],
            ['key' => 'ai', 'name' => 'AI Assistant'],
        ];

        foreach ($modules as $i => $module) {
            Module::query()->updateOrCreate(
                ['key' => $module['key']],
                $module + ['sort_order' => $i, 'is_core' => $module['is_core'] ?? false],
            );
        }
    }
}
