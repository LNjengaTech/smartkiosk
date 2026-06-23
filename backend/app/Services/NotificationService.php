<?php

// backend/app/Services/NotificationService.php
// Purpose: Central service for dispatching all platform notifications.
//          Called by the scheduler, SaleService, StockService, and SyncController.

namespace App\Services;

use App\Models\Sale;
use App\Models\Shop;
use App\Models\User;
use App\Notifications\DailySummaryNotification;
use App\Notifications\ExpiryAlertNotification;
use App\Notifications\LowStockNotification;
use App\Notifications\SaleVoidedNotification;
use App\Notifications\SyncFailedNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    public function __construct(
        private readonly ReportService $reportService,
    ) {}

    /**
     * Check low-stock products for a shop and notify the owner.
     * Deduplicates — skips if a LowStockNotification for the same product
     * was already sent in the last 24 hours.
     */
    public function checkAndNotifyLowStock(Shop $shop): void
    {
        $owner = $shop->owner;

        if ($owner === null) {
            return;
        }

        $lowStockProducts = $shop->products()
            ->where('is_active', true)
            ->whereRaw('quantity <= reorder_level')
            ->get();

        foreach ($lowStockProducts as $product) {
            // Dedup: skip if already notified for this product in the last 24h
            $alreadyNotified = DB::table('notifications')
                ->where('notifiable_type', User::class)
                ->where('notifiable_id', $owner->id)
                ->where('type', LowStockNotification::class)
                ->whereRaw("data::jsonb->>'productId' = ?", [(string) $product->uuid])
                ->where('created_at', '>=', Carbon::now()->subDay())
                ->exists();

            if ($alreadyNotified) {
                continue;
            }

            try {
                $owner->notify(new LowStockNotification(
                    productName: $product->name,
                    currentQuantity: (float) $product->quantity,
                    reorderLevel: (float) $product->reorder_level,
                    shopName: $shop->business_name,
                    productId: (string) $product->uuid,
                ));
            } catch (\Throwable $e) {
                Log::error('NotificationService: Failed to send LowStockNotification', [
                    'shop_id' => $shop->id,
                    'product_id' => $product->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Check products expiring within 7 days for a shop and notify the owner.
     * Deduplicates — skips if an ExpiryAlertNotification was already sent today.
     */
    public function checkAndNotifyExpiringSoon(Shop $shop): void
    {
        $owner = $shop->owner;

        if ($owner === null) {
            return;
        }

        $expiringProducts = $shop->products()
            ->where('is_active', true)
            ->whereNotNull('expiry_date')
            ->whereBetween('expiry_date', [
                Carbon::today(),
                Carbon::today()->addDays(7),
            ])
            ->get();

        if ($expiringProducts->isEmpty()) {
            return;
        }

        // Dedup: skip if already notified today for this shop
        $alreadyNotified = DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $owner->id)
            ->where('type', ExpiryAlertNotification::class)
            ->where('created_at', '>=', Carbon::today())
            ->exists();

        if ($alreadyNotified) {
            return;
        }

        $products = $expiringProducts->map(function ($product) {
            $expiry = Carbon::parse($product->expiry_date);
            $daysRemaining = (int) Carbon::today()->diffInDays($expiry);

            return [
                'name' => $product->name,
                'expiryDate' => $expiry->toDateString(),
                'daysRemaining' => $daysRemaining,
                'quantity' => (float) $product->quantity,
            ];
        })->sortBy('daysRemaining')->values()->all();

        try {
            $owner->notify(new ExpiryAlertNotification(
                products: $products,
                shopName: $shop->business_name,
            ));
        } catch (\Throwable $e) {
            Log::error('NotificationService: Failed to send ExpiryAlertNotification', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send nightly daily summary to the shop owner.
     * Reuses ReportService::dashboardSummary() for metric aggregation.
     */
    public function sendDailySummary(Shop $shop): void
    {
        $owner = $shop->owner;

        if ($owner === null) {
            return;
        }

        try {
            $summary = $this->reportService->dashboardSummary($shop->id);

            $topProduct = null;
            if (! empty($summary->topProductsToday)) {
                $top = $summary->topProductsToday[0];
                $topProduct = [
                    'name' => $top->name,
                    'revenue' => $top->revenue,
                ];
            }

            $owner->notify(new DailySummaryNotification(
                shopName: $shop->business_name,
                ownerName: $owner->name,
                date: Carbon::today()->toDateString(),
                todayRevenue: $summary->todayRevenue,
                todayOrders: $summary->todayOrderCount,
                todayProfit: $summary->todayProfit,
                topProduct: $topProduct,
                lowStockCount: $summary->lowStockCount,
            ));
        } catch (\Throwable $e) {
            Log::error('NotificationService: Failed to send DailySummaryNotification', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Notify the shop owner when a sale is voided.
     * Called directly by SaleService after a void action.
     */
    public function notifySaleVoided(Sale $sale, User $actor): void
    {
        $shop = $sale->shop;

        if ($shop === null) {
            return;
        }

        $owner = $shop->owner;

        if ($owner === null || $owner->id === $actor->id) {
            // Don't notify the owner if they voided it themselves
            return;
        }

        $items = $sale->items->map(fn ($item) => [
            'name' => $item->product_name,
            'quantity' => (float) $item->quantity,
            'total' => (float) $item->total,
        ])->all();

        try {
            $owner->notify(new SaleVoidedNotification(
                receiptNumber: $sale->receipt_number,
                total: (float) $sale->total_amount,
                voidedBy: $actor->name,
                voidedAt: Carbon::parse($sale->updated_at)->toIso8601String(),
                items: $items,
                shopName: $shop->business_name,
            ));
        } catch (\Throwable $e) {
            Log::error('NotificationService: Failed to send SaleVoidedNotification', [
                'sale_id' => $sale->id,
                'actor_id' => $actor->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send a SyncFailedNotification to the shop owner if the sync queue is stuck.
     * Called by the NotificationController when the client reports a stuck queue.
     */
    public function notifySyncFailed(Shop $shop, int $pendingCount, string $oldestPendingAt): void
    {
        $owner = $shop->owner;

        if ($owner === null) {
            return;
        }

        // Dedup: skip if already notified in the last 2 hours
        $alreadyNotified = DB::table('notifications')
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $owner->id)
            ->where('type', SyncFailedNotification::class)
            ->where('created_at', '>=', Carbon::now()->subHours(2))
            ->exists();

        if ($alreadyNotified) {
            return;
        }

        try {
            $owner->notify(new SyncFailedNotification(
                pendingCount: $pendingCount,
                oldestPendingAt: $oldestPendingAt,
            ));
        } catch (\Throwable $e) {
            Log::error('NotificationService: Failed to send SyncFailedNotification', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
