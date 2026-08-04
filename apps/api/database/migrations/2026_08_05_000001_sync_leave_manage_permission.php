<?php

use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;

/**
 * Adds hr.leave.manage. Deployments run migrations but not seeders, so a new
 * permission has to ship as one of these or it exists in code and not in the
 * database. See docs/13-railway-deployment.md.
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
