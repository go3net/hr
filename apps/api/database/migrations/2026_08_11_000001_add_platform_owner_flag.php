<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marks the handful of people who run Go3net Office as a business, as opposed
 * to running one workspace inside it. A super_admin is the top of one tenant;
 * this is the only thing that reaches across tenants, and it deliberately
 * grants account-level oversight only — never a customer's HR data.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_platform_owner')->default(false)->after('status');
            $table->index('is_platform_owner');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['is_platform_owner']);
            $table->dropColumn('is_platform_owner');
        });
    }
};
