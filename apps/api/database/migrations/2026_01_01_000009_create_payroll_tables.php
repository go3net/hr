<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('period', 7); // YYYY-MM
            $table->string('status')->default('draft'); // draft|approved|published
            $table->decimal('gross_total', 16, 2)->default(0);
            $table->decimal('net_total', 16, 2)->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'period']);
        });

        Schema::create('payroll_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('payroll_run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->decimal('basic', 14, 2);
            $table->json('allowances')->nullable();   // {housing: 50000, transport: 25000, ...}
            $table->json('deductions')->nullable();   // {loan: 10000, ...}
            $table->decimal('gross', 14, 2);
            $table->decimal('pension_employee', 14, 2)->default(0);
            $table->decimal('pension_employer', 14, 2)->default(0);
            $table->decimal('paye_tax', 14, 2)->default(0);
            $table->decimal('net', 14, 2);
            $table->string('payslip_path')->nullable();
            $table->timestamps();
            $table->unique(['payroll_run_id', 'employee_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_items');
        Schema::dropIfExists('payroll_runs');
    }
};
