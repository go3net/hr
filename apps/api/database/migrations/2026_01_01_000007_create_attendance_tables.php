<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('office_id')->nullable()->constrained()->nullOnDelete();
            $table->date('work_date');
            $table->timestamp('clocked_in_at');
            $table->timestamp('clocked_out_at')->nullable();
            $table->string('method')->default('web'); // gps|qr|web|biometric
            $table->decimal('in_latitude', 10, 7)->nullable();
            $table->decimal('in_longitude', 10, 7)->nullable();
            $table->decimal('out_latitude', 10, 7)->nullable();
            $table->decimal('out_longitude', 10, 7)->nullable();
            $table->boolean('is_late')->default(false);
            $table->unsignedInteger('minutes_late')->default(0);
            $table->boolean('left_early')->default(false);
            $table->timestamps();
            $table->unique(['tenant_id', 'employee_id', 'work_date']);
            $table->index(['tenant_id', 'work_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
    }
};
