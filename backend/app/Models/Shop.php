<?php

// backend/app/Models/Shop.php
// Purpose: Represents a registered business (tenant) on the SmartKiosk platform.

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Shop extends Model
{
    use SoftDeletes;

    protected $table = 'shops';

    protected $fillable = [
        'uuid',
        'business_name',
        'owner_id',
        'parent_shop_id',
        'location',
        'phone',
        'email',
        'currency',
        'timezone',
        'is_active',
        'synced_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'synced_at' => 'datetime',
    ];

    /**
     * Boot model events - auto-generates client-safe UUID.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($shop) {
            if (empty($shop->uuid)) {
                $shop->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * Get the business owner.
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * Get all users registered under this shop.
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'shop_id');
    }

    /**
     * Get products in inventory catalog.
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class, 'shop_id');
    }

    /**
     * Get all sales recorded.
     */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class, 'shop_id');
    }

    /**
     * Get shop subscription details.
     */
    public function subscription(): HasOne
    {
        return $this->hasOne(ShopSubscription::class, 'shop_id');
    }

    /**
     * Get all branch locations for this main shop.
     */
    public function branches(): HasMany
    {
        return $this->hasMany(Shop::class, 'parent_shop_id');
    }

    /**
     * Get the parent headquarters shop (if this is a branch).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'parent_shop_id');
    }
}
