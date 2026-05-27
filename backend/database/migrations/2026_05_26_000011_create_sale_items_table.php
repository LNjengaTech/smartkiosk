<?php

/* database/migrations/2026_05_26_000011_create_sale_items_table.php */
/* Purpose: Sale items table migration. Immutable after creation. */

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
        Schema::create('sale_items', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('sale_id');
            $table->unsignedBigInteger('product_id')->nullable(); // Nullable in case product is deleted
            $table->string('product_name'); // Snapshotted name at time of sale
            $table->decimal('quantity', 12, 3);
            $table->decimal('unit_price', 12, 2); // Snapshotted price at time of sale
            $table->decimal('buying_price', 12, 2); // Snapshotted cost price for margin tracking
            $table->decimal('discount', 12, 2)->default(0.00);
            $table->decimal('total', 12, 2);
            $table->timestamp('created_at')->useCurrent(); // Immutable - only created_at is used

            // Foreign Keys
            $table->foreign('sale_id')->references('id')->on('sales')->onDelete('cascade');
            $table->foreign('product_id')->references('id')->on('products')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sale_items');
    }
};
