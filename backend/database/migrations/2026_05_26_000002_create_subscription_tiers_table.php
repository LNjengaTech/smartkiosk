<?php

/* database/migrations/2026_05_26_000002_create_subscription_tiers_table.php */
/* Purpose: Subscription tiers table migration. */

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('subscription_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique(); // e.g. basic, pro, enterprise
            $table->decimal('price_kes', 12, 2)->nullable(); // null for custom enterprise pricing
            $table->integer('product_limit')->nullable(); // null = unlimited
            $table->integer('branch_limit')->nullable();
            $table->integer('ai_token_limit')->nullable();
            $table->json('features'); // Feature flags map e.g. {"ai_insights": true, "multi_branch": false}
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subscription_tiers');
    }
};
