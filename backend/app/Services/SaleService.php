<?php

// backend/app/Services/SaleService.php
// Purpose: Business logic for sale creation — validates, processes, and atomically
//          commits sales with stock decrements. Never trusts client-supplied totals.

namespace App\Services;

use App\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use App\Models\SyncLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Carbon;

class SaleService
{
    public function __construct(
        private readonly StockService $stockService
    ) {}

    /**
     * Process a sale from the sync engine or direct POS submit.
     * ALL amounts are recalculated server-side from current product prices.
     * Client-supplied prices are stored as snapshots but never used for totals.
     *
     * @throws InsufficientStockException if any item has insufficient stock
     * @throws ValidationException if items are empty or product not found
     */
    public function processSale(array $data, User $cashier): Sale
    {
        if (empty($data['items'])) {
            throw ValidationException::withMessages([
                'items' => ['The sale must contain at least one item.']
            ]);
        }

        return DB::transaction(function () use ($data, $cashier) {
            $shopId = $cashier->shop_id;
            
            $subtotal = 0.00;
            $discountAmount = 0.00; // Recalculated if discounts are implemented
            $taxAmount = 0.00; // No tax in stage 3
            
            $itemsToCreate = [];

            // 1. Process each item
            foreach ($data['items'] as $itemData) {
                $productUuid = $itemData['product_uuid'] ?? null;
                $quantity = (float) ($itemData['quantity'] ?? 0);

                if (!$productUuid) {
                    throw ValidationException::withMessages([
                        'items' => ['Product UUID is required for all items.']
                    ]);
                }

                // Lock the product row for update to prevent race conditions (OWASP)
                $product = Product::where('shop_id', $shopId)
                    ->where('uuid', $productUuid)
                    ->lockForUpdate()
                    ->first();

                if (!$product) {
                    throw ValidationException::withMessages([
                        'items' => ["Product with UUID {$productUuid} not found or access denied."]
                    ]);
                }

                // Verify stock level before proceeding
                if ($product->quantity < $quantity) {
                    throw new InsufficientStockException(
                        productName: $product->name,
                        requested:   $quantity,
                        available:   $product->quantity,
                    );
                }

                // Recalculate totals using the server's selling price (OWASP)
                $itemUnitPrice = (float) $product->selling_price;
                $itemSubtotal = $itemUnitPrice * $quantity;
                $subtotal += $itemSubtotal;

                $itemsToCreate[] = [
                    'product' => $product,
                    'quantity' => $quantity,
                    'unit_price' => $itemUnitPrice,
                    'buying_price' => (float) $product->buying_price,
                    'discount' => 0.00,
                    'total' => $itemSubtotal,
                ];
            }

            $totalAmount = $subtotal - $discountAmount + $taxAmount;

            // Recalculate change if paid method is cash
            $amountPaid = (float) ($data['amount_paid'] ?? $totalAmount);
            $changeAmount = max(0.00, $amountPaid - $totalAmount);

            // Generate receipt number
            $receiptNumber = $this->generateReceiptNumber($shopId);

            // Create Sale record
            $sale = Sale::create([
                'uuid' => $data['uuid'] ?? (string) \Illuminate\Support\Str::uuid(),
                'shop_id' => $shopId,
                'user_id' => $cashier->id,
                'receipt_number' => $receiptNumber,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'tax_amount' => $taxAmount,
                'total_amount' => $totalAmount,
                'amount_paid' => $amountPaid,
                'change_amount' => $changeAmount,
                'payment_method' => $data['payment_method'],
                'mpesa_reference' => $data['mpesa_reference'] ?? null,
                'status' => 'completed',
                'notes' => $data['notes'] ?? null,
                'sold_at' => isset($data['sold_at']) ? Carbon::parse($data['sold_at']) : Carbon::now(),
                'synced_at' => Carbon::now(),
            ]);

            // Create SaleItems & Apply Stock Deltas (reusing StockService)
            foreach ($itemsToCreate as $item) {
                /** @var Product $product */
                $product = $item['product'];
                
                SaleItem::create([
                    'uuid' => (string) \Illuminate\Support\Str::uuid(),
                    'sale_id' => $sale->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'buying_price' => $item['buying_price'],
                    'discount' => $item['discount'],
                    'total' => $item['total'],
                ]);

                // Call StockService::applyDelta with negative quantity (stock decrement)
                $this->stockService->applyDelta(
                    product: $product,
                    delta: -$item['quantity'],
                    movementType: 'sale',
                    userId: $cashier->id,
                    notes: "POS Sale: {$receiptNumber}"
                );
            }

            // Create SyncLog entry (if tracked locally/sync batch)
            if (isset($data['operation_uuid'])) {
                SyncLog::create([
                    'operation_uuid' => $data['operation_uuid'],
                    'shop_id' => $shopId,
                    'resource_type' => 'sale',
                    'resource_uuid' => $sale->uuid,
                    'status' => 'success',
                    'occurred_at' => $sale->sold_at,
                ]);
            }

            return $sale->load('items');
        });
    }

    /**
     * Void a sale — reverses stock and marks sale as voided.
     * Requires manager or owner role.
     */
    public function voidSale(Sale $sale, User $actor): Sale
    {
        return DB::transaction(function () use ($sale, $actor) {
            // 1. Verify sale status is 'completed'
            if ($sale->status !== 'completed') {
                throw ValidationException::withMessages([
                    'status' => ['Only completed sales can be voided.']
                ]);
            }

            // 2. For each SaleItem: apply positive delta to reverse the stock decrement
            foreach ($sale->items as $item) {
                if ($item->product_id) {
                    $product = Product::find($item->product_id);
                    if ($product) {
                        $this->stockService->applyDelta(
                            product: $product,
                            delta: $item->quantity,
                            movementType: 'adjustment',
                            userId: $actor->id,
                            notes: "Reversed from voided sale: {$sale->receipt_number}"
                        );
                    }
                }
            }

            // 3. Update sale status to 'voided'
            $sale->update([
                'status' => 'voided',
            ]);

            // 4. Log the void action in audit_logs (or custom log)
            // If there's an audit/activity log model, we can write here, or write to Laravel log
            \Illuminate\Support\Facades\Log::info("Sale Voided: {$sale->receipt_number} by User {$actor->id}");

            return $sale->load('items');
        });
    }

    private function generateReceiptNumber(int $shopId): string
    {
        $year = Carbon::now()->year;
        // Use a PostgreSQL sequence for collision-free receipt number generation.
        $sequence = DB::selectOne(
            "SELECT nextval('receipt_sequence') AS seq"
        )->seq;
        return sprintf('SK-%d-%06d', $year, $sequence);
    }
}
