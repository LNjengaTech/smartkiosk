<?php

// database/migrations/2026_06_06_000000_create_receipt_sequence.php
// Purpose: PostgreSQL sequence for collision-free receipt number generation.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("CREATE SEQUENCE IF NOT EXISTS receipt_sequence START 1");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("DROP SEQUENCE IF EXISTS receipt_sequence");
    }
};
