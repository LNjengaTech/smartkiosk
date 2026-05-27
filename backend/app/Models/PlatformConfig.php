<?php

// backend/app/Models/PlatformConfig.php
// Purpose: Singleton platform configuration model for Super Admin parameters.

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformConfig extends Model
{
    protected $table = 'platform_configs';

    protected $fillable = [
        'is_master_switch_on',
        'platform_name',
        'support_email',
        'support_whatsapp',
    ];

    protected $casts = [
        'is_master_switch_on' => 'boolean',
    ];

    /**
     * Singleton instance retriever.
     * Fetches or automatically seeds the global configuration if missing.
     */
    public static function instance(): self
    {
        return self::firstOrCreate(
            ['id' => 1],
            [
                'is_master_switch_on' => false, // Default: full access to Pro tier features
                'platform_name' => 'SmartKiosk',
                'support_email' => 'support@smartkiosk.app',
                'support_whatsapp' => '+254700000000',
            ]
        );
    }
}
