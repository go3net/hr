<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('plan_key', 40)->nullable()->after('status');
            $table->timestamp('subscription_ends_at')->nullable()->after('trial_ends_at');
        });

        Schema::create('billing_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('plan_key', 40);
            $table->decimal('amount', 12, 2); // Naira
            $table->string('reference', 60)->unique();
            $table->string('status', 20)->default('pending'); // pending|paid|failed
            $table->string('channel', 30)->nullable(); // card|bank|ussd|transfer…
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('billing_payments');
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['plan_key', 'subscription_ends_at']);
        });
    }
};
