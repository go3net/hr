<?php

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

/**
 * Permissions and system roles are defined in RolePermissionSeeder, which is
 * idempotent and only touches system rows (tenant_id null). Deployments run
 * migrations automatically but not seeders, so each sprint that introduces a
 * permission ships a migration like this to push the catalogue to production.
 */
return new class extends Migration
{
    public function up(): void
    {
        Artisan::call('db:seed', ['--class' => RolePermissionSeeder::class, '--force' => true]);
    }

    public function down(): void
    {
        // Nothing to roll back — the seeder is the source of truth.
    }
};
