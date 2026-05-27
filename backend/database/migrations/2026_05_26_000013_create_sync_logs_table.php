<?php

/* database/migrations/2026_05_26_000013_create_sync_logs_table.php */
/* Purpose: Sync logs table migration. Append-only ledger for synchronization actions. */

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
        Schema::create('sync_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('shop_id');
            $table->unsignedBigInteger('user_id');
            $table->uuid('operation_uuid')->unique(); // NanoID/UUID sent from client sync engine
            $table->string('resource_type'); // e.g. sale, product, stock_movement
            $table->uuid('resource_uuid'); // UUID of the synced resource
            $table->enum('status', ['success', 'conflict', 'failed']);
            $table->text('conflict_resolution')->nullable();
            $table->timestamp('synced_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent(); // Immutable log

            $table->foreign('shop_id')->references('id')->on('shops')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sync_logs');
    }
};
