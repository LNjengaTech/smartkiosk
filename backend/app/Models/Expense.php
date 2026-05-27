<?php

// backend/app/Models/Expense.php
// Purpose: Represents an operational expense recorded by shop staff.

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Expense extends Model
{
    use SoftDeletes;

    protected $table = 'expenses';

    protected $fillable = [
        'uuid',
        'shop_id',
        'user_id',
        'category',
        'amount',
        'description',
        'expense_date',
        'receipt_url',
        'synced_at',
    ];

    protected $casts = [
        'amount' => 'float',
        'expense_date' => 'date:Y-m-d',
        'synced_at' => 'datetime',
    ];

    /**
     * Boot model events - auto-generates client-safe UUID.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($expense) {
            if (empty($expense->uuid)) {
                $expense->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * Scope query to only include expenses belonging to a specific shop.
     */
    public function scopeForShop(Builder $query, int $shopId): Builder
    {
        return $query->where('shop_id', $shopId);
    }

    /**
     * Get the shop related to this expense.
     */
    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'shop_id');
    }

    /**
     * Get the user who recorded this expense.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
