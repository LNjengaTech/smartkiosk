<?php

// backend/app/Models/SubscriptionTier.php
// Purpose: Defines platform billing plans and operational feature gates.

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionTier extends Model
{
    protected $table = 'subscription_tiers';

    protected $fillable = [
        'name',
        'price_kes',
        'product_limit',
        'branch_limit',
        'ai_token_limit',
        'features',
        'is_active',
    ];

    protected $casts = [
        'price_kes' => 'float',
        'product_limit' => 'integer',
        'branch_limit' => 'integer',
        'ai_token_limit' => 'integer',
        'features' => 'array', // Decodes DB JSON automatically to array
        'is_active' => 'boolean',
    ];
}
