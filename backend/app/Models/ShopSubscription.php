<?php

// backend/app/Models/ShopSubscription.php
// Purpose: Tracks tenant subscription cycles, trial periods, and tier statuses.

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShopSubscription extends Model
{
    protected $table = 'shop_subscriptions';

    protected $fillable = [
        'shop_id',
        'plan',
        'trial_ends_at',
        'subscription_ends_at',
        'is_active',
    ];

    protected $casts = [
        'trial_ends_at' => 'datetime',
        'subscription_ends_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    /**
     * Get the shop related to this subscription.
     */
    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'shop_id');
    }

    /**
     * Determine if the shop is currently within its trial period.
     */
    public function isOnTrial(): bool
    {
        return $this->trial_ends_at && $this->trial_ends_at->isFuture();
    }

    /**
     * Check if the shop's active plan has expired.
     */
    public function isExpired(): bool
    {
        // Active bypass if platform Super Admin deactivated subscription gating
        if (! $this->is_active) {
            return true;
        }

        // If on trial, not expired
        if ($this->isOnTrial()) {
            return false;
        }

        // Otherwise, verify if billing cycle end date has passed
        return $this->subscription_ends_at && $this->subscription_ends_at->isPast();
    }
}
