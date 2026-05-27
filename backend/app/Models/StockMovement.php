<?php

// backend/app/Models/StockMovement.php
// Purpose: Append-only ledger of every stock change. Never updated or deleted.

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Str;
use RuntimeException;

class StockMovement extends Model
{
    // Append-only ledger - disable default updated_at
    const UPDATED_AT = null;

    protected $table = 'stock_movements';

    protected $fillable = [
        'uuid',
        'shop_id',
        'product_id',
        'user_id',
        'movement_type',
        'delta',
        'quantity_before',
        'quantity_after',
        'unit_cost',
        'reference_id',
        'reference_type',
        'notes',
        'occurred_at',
        'synced_at',
    ];

    protected $casts = [
        'delta' => 'float',
        'quantity_before' => 'float',
        'quantity_after' => 'float',
        'unit_cost' => 'float',
        'occurred_at' => 'datetime',
        'synced_at' => 'datetime',
    ];

    /**
     * Boot model events - auto-generates client UUID, and defends immutability rules.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($movement) {
            if (empty($movement->uuid)) {
                $movement->uuid = (string) Str::uuid();
            }
        });

        static::updating(function ($movement) {
            throw new RuntimeException('StockMovements ledger is append-only. Modifying existing entries is prohibited.');
        });

        static::deleting(function ($movement) {
            throw new RuntimeException('StockMovements ledger is append-only. Deleting entries is prohibited.');
        });
    }

    /**
     * Get the shop related to this movement log.
     */
    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'shop_id');
    }

    /**
     * Get the product affected.
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /**
     * Get the staff user who executed the adjustment.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the parent polymorphic model record (e.g. Sale).
     */
    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
