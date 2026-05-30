<?php

// backend/app/Services/StockService.php
// Purpose: Atomic stock management service.
//          All mutations run inside a lockForUpdate() transaction to prevent race conditions.
//          Every change generates an immutable StockMovement audit ledger entry.

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StockService
{
    /**
     * Apply a signed stock delta (positive = in, negative = out) to a product.
     *
     * - Acquires a row-level lock via lockForUpdate() to prevent races.
     * - Raises InsufficientStockException if the result would go below 0.
     * - Creates an immutable StockMovement record (append-only ledger).
     *
     * @param  Product  $product       The product to adjust
     * @param  float    $delta         Signed quantity change (+stock_in / -stock_out)
     * @param  string   $movementType  'stock_in' | 'stock_out' | 'adjustment' | 'sale'
     * @param  int      $userId        ID of the staff member performing the adjustment
     * @param  float|null $unitCost    Unit cost for stock_in movements (for FIFO valuation)
     * @param  string|null $notes      Optional audit note
     * @return StockMovement           The created immutable ledger entry
     *
     * @throws InsufficientStockException
     */
    public function applyDelta(
        Product $product,
        float   $delta,
        string  $movementType,
        int     $userId,
        ?float  $unitCost = null,
        ?string $notes    = null,
    ): StockMovement {
        return DB::transaction(function () use ($product, $delta, $movementType, $userId, $unitCost, $notes) {
            // Acquire a row-level lock for the duration of this transaction
            /** @var Product $locked */
            $locked = Product::lockForUpdate()->findOrFail($product->id);

            $quantityBefore = (float) $locked->quantity;
            $quantityAfter  = $quantityBefore + $delta;

            // Guard against negative stock
            if ($quantityAfter < 0) {
                throw new InsufficientStockException(
                    productName: $locked->name,
                    requested:   abs($delta),
                    available:   $quantityBefore,
                );
            }

            // Persist the new quantity
            $locked->quantity = $quantityAfter;
            $locked->save();

            // Append an immutable audit record
            $movement = StockMovement::create([
                'uuid'            => (string) Str::uuid(),
                'shop_id'         => $locked->shop_id,
                'product_id'      => $locked->id,
                'user_id'         => $userId,
                'movement_type'   => $movementType,
                'delta'           => $delta,
                'quantity_before' => $quantityBefore,
                'quantity_after'  => $quantityAfter,
                'unit_cost'       => $unitCost,
                'notes'           => $notes,
                'occurred_at'     => Carbon::now(),
            ]);

            return $movement;
        });
    }

    /**
     * Stock-in: add positive quantity (e.g. goods received from supplier).
     */
    public function stockIn(
        Product $product,
        float   $quantity,
        int     $userId,
        ?float  $unitCost = null,
        ?string $notes    = null,
    ): StockMovement {
        return $this->applyDelta(
            product:      $product,
            delta:        abs($quantity),
            movementType: 'stock_in',
            userId:       $userId,
            unitCost:     $unitCost,
            notes:        $notes,
        );
    }

    /**
     * Stock-out: remove quantity (manual wastage, damage, etc.).
     */
    public function stockOut(
        Product $product,
        float   $quantity,
        int     $userId,
        ?string $notes = null,
    ): StockMovement {
        return $this->applyDelta(
            product:      $product,
            delta:        -abs($quantity),
            movementType: 'stock_out',
            userId:       $userId,
            notes:        $notes,
        );
    }
}
