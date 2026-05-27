<?php

/* database/migrations/2026_05_26_000009_create_stock_movements_table.php */
/* Purpose: Stock movements immutable ledger table migration. */

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
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('shop_id');
            $table->unsignedBigInteger('product_id');
            $table->unsignedBigInteger('user_id');
            $table->enum('movement_type', ['stock_in', 'stock_out', 'sale', 'adjustment', 'damage', 'transfer']);
            $table->decimal('delta', 12, 3); // Negative for stock reductions, positive for additions
            $table->decimal('quantity_before', 12, 3);
            $table->decimal('quantity_after', 12, 3);
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable(); // Polymorphic references
            $table->string('reference_type')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('occurred_at')->useCurrent(); // Client-side execution timestamp
            $table->timestamp('synced_at')->nullable();
            $table->timestamp('created_at')->useCurrent(); // Immutable - only created_at is captured

            // Foreign Keys
            $table->foreign('shop_id')->references('id')->on('shops')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

            // Compound index for tracking movements over time per product
            $table->index(['product_id', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
