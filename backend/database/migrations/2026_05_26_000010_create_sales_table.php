<?php

/* database/migrations/2026_05_26_000010_create_sales_table.php */
/* Purpose: Sales transactions table migration. */

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
        Schema::create('sales', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->unsignedBigInteger('shop_id');
            $table->unsignedBigInteger('user_id'); // Cashier/staff member ID
            $table->string('receipt_number')->unique(); // e.g. SK-YYYY-NNNNNN
            $table->decimal('subtotal', 12, 2);
            $table->decimal('discount_amount', 12, 2)->default(0.00);
            $table->decimal('tax_amount', 12, 2)->default(0.00);
            $table->decimal('total_amount', 12, 2);
            $table->decimal('amount_paid', 12, 2);
            $table->decimal('change_amount', 12, 2)->default(0.00);
            $table->enum('payment_method', ['cash', 'mpesa', 'bank', 'mixed']);
            $table->string('mpesa_reference')->nullable();
            $table->enum('status', ['completed', 'voided', 'refunded'])->default('completed');
            $table->text('notes')->nullable();
            $table->timestamp('sold_at')->useCurrent(); // Client-side sale execution timestamp
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            // Foreign Keys
            $table->foreign('shop_id')->references('id')->on('shops')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

            // Compound index for querying sales histories per tenant
            $table->index(['shop_id', 'sold_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales');
    }
};
