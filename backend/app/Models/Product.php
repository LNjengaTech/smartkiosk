<?php

// backend/app/Models/Product.php
// Purpose: A product in the shop's inventory catalogue.

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class Product extends Model
{
    use SoftDeletes;

    protected $table = 'products';

    protected $fillable = [
        'uuid',
        'shop_id',
        'category_id',
        'supplier_id',
        'name',
        'sku',
        'barcode',
        'buying_price',
        'selling_price',
        'quantity',
        'reorder_level',
        'unit',
        'expiry_date',
        'image_url',
        'is_active',
        'synced_at',
    ];

    protected $casts = [
        'buying_price' => 'float',
        'selling_price' => 'float',
        'quantity' => 'float',
        'reorder_level' => 'float',
        'is_active' => 'boolean',
        'expiry_date' => 'date:Y-m-d',
        'synced_at' => 'datetime',
    ];

    /**
     * Boot model events - auto-generates client-safe UUID.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($product) {
            if (empty($product->uuid)) {
                $product->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * Scope query to filter by barcode.
     */
    public function scopeByBarcode(Builder $query, string $barcode): Builder
    {
        return $query->where('barcode', $barcode);
    }

    /**
     * Scope query to find products whose quantity has reached or dropped below reorder level.
     */
    public function scopeLowStock(Builder $query): Builder
    {
        return $query->whereColumn('quantity', '<=', 'reorder_level');
    }

    /**
     * Scope query to only include products belonging to a specific shop.
     */
    public function scopeForShop(Builder $query, int $shopId): Builder
    {
        return $query->where('shop_id', $shopId);
    }

    /**
     * Determine if a product is running low on stock.
     */
    public function isLowStock(): bool
    {
        return $this->quantity <= $this->reorder_level;
    }

    /**
     * Determine if a product is expiring within the specified days.
     */
    public function isExpiringSoon(int $days = 7): bool
    {
        if (! $this->expiry_date) {
            return false;
        }

        $now = Carbon::today();
        $target = Carbon::today()->addDays($days);

        return $this->expiry_date->between($now, $target);
    }

    /**
     * Get the gross profit amount (selling price minus buying cost).
     */
    public function profitMargin(): float
    {
        return max(0.00, $this->selling_price - $this->buying_price);
    }

    /**
     * Get the category related to this product.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    /**
     * Get the supplier related to this product.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    /**
     * Get all stock movement logs related to this product.
     */
    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class, 'product_id');
    }
}
