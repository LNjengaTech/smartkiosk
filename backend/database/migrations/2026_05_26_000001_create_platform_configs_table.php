<?php

/* database/migrations/2026_05_26_000001_create_platform_configs_table.php */
/* Purpose: Platform config singleton table migration. */

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
        Schema::create('platform_configs', function (Blueprint $table) {
            $table->id(); // Will always be 1
            $table->boolean('is_master_switch_on')->default(false);
            $table->string('platform_name')->default('SmartKiosk');
            $table->string('support_email')->nullable();
            $table->string('support_whatsapp')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('platform_configs');
    }
};
