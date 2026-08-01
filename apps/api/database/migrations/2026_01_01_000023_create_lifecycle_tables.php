<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('onboarding_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('title', 200);
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_date')->nullable();
            $table->string('status', 10)->default('pending'); // pending|done
            $table->timestamp('completed_at')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'employee_id']);
        });

        Schema::create('company_assets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('tag', 60); // asset tag, unique per tenant
            $table->string('category', 30)->default('laptop'); // laptop|phone|monitor|furniture|vehicle|other
            $table->string('serial_number', 120)->nullable();
            $table->string('status', 15)->default('available'); // available|assigned|maintenance|retired
            $table->foreignId('assigned_employee_id')->nullable()->constrained('employees')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable();
            $table->string('notes', 300)->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'tag']);
            $table->index(['tenant_id', 'status']);
        });

        Schema::create('asset_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_asset_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->timestamp('assigned_at');
            $table->timestamp('returned_at')->nullable();
            $table->string('condition_note', 300)->nullable();
            $table->timestamps();
        });

        Schema::create('exits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 20); // resignation|termination|retirement|contract_end|other
            $table->date('notice_date')->nullable();
            $table->date('last_working_day');
            $table->string('status', 12)->default('clearance'); // clearance|completed|cancelled
            $table->text('notes')->nullable();
            $table->foreignId('initiated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        Schema::create('exit_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('exit_id')->constrained()->cascadeOnDelete();
            $table->string('title', 200);
            $table->string('status', 10)->default('pending'); // pending|done
            $table->timestamp('completed_at')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exit_tasks');
        Schema::dropIfExists('exits');
        Schema::dropIfExists('asset_assignments');
        Schema::dropIfExists('company_assets');
        Schema::dropIfExists('onboarding_tasks');
    }
};
