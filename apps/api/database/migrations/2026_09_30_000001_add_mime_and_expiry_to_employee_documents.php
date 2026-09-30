<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The table has been there since the first migration, waiting for something
 * to write to it. Two columns were missing for what it is actually used for:
 * the mime type, so a download is served as the PDF or image it is rather
 * than a generic blob, and an expiry, because passports and work permits
 * lapse and a licence nobody renewed is worth being able to find.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employee_documents', function (Blueprint $table) {
            $table->string('mime')->nullable()->after('path');
            $table->date('expires_on')->nullable()->after('size_bytes');
        });
    }

    public function down(): void
    {
        Schema::table('employee_documents', function (Blueprint $table) {
            $table->dropColumn(['mime', 'expires_on']);
        });
    }
};
