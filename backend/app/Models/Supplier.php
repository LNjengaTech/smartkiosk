<?php

// backend/app/Models/Supplier.php
// Purpose: Represents a stock supplier with transactional running balances.

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Supplier extends Model
{
    use SoftDeletes;

    protected $table = 'suppliers';

    protected $fillable = [
        'uuid',
        'shop_id',
        'name',
        'phone',
        'email',
        'address',
        'balance',
        'notes',
        'synced_at',
    ];

    protected $casts = [
        'balance' => 'float',
        'synced_at' => 'datetime',
    ];

    /**
     * Boot model events - auto-generates client-safe UUID.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($supplier) {
            if (empty($supplier->uuid)) {
                $supplier->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * Scope query to only include suppliers belonging to a specific shop.
     */
    public function scopeForShop(Builder $query, int $shopId): Builder
    {
        return $query->where('shop_id', $shopId);
    }
}
