<?php

// backend/app/Models/SaleItem.php
// Purpose: Individual line item captured within a POS customer transaction.

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class SaleItem extends Model
{
    // Disable default updated_at field - sale items are immutable snapshots
    const UPDATED_AT = null;

    protected $table = 'sale_items';

    protected $fillable = [
        'uuid',
        'sale_id',
        'product_id',
        'product_name',
        'quantity',
        'unit_price',
        'buying_price',
        'discount',
        'total',
    ];

    protected $casts = [
        'quantity' => 'float',
        'unit_price' => 'float',
        'buying_price' => 'float',
        'discount' => 'float',
        'total' => 'float',
    ];

    /**
     * Boot model events - auto-generates client-safe UUID.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($item) {
            if (empty($item->uuid)) {
                $item->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * Get the master sale transaction relation.
     */
    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class, 'sale_id');
    }

    /**
     * Get the current product catalog relation (if it still exists).
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
