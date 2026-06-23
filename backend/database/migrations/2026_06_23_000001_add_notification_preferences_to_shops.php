<?php

// database/migrations/2026_06_23_000001_add_notification_preferences_to_shops.php
// Purpose: Adds a JSON column to shops for per-shop notification channel preferences.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shops', function (Blueprint $table) {
            $table->json('notification_preferences')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('shops', function (Blueprint $table) {
            $table->dropColumn('notification_preferences');
        });
    }
};
