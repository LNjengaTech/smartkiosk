<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/StockController.php
// Purpose: Handles manual stock adjustments (in/out) and movement history queries.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Stock\AdjustStockRequest;
use App\Http\Resources\Api\V1\StockMovementResource;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\StockService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly StockService $stockService,
    ) {}

    /**
     * GET /api/v1/stock/movements
     * List paginated stock movements for the shop, newest first.
     * Optional filters: product_id, movement_type, date range.
     */
    public function movements(Request $request): JsonResponse
    {
        $shopId  = $request->user()->shop_id;
        $perPage = $request->integer('per_page', 50);

        $query = StockMovement::query()
            ->where('shop_id', $shopId)
            ->with(['product', 'user'])
            ->orderBy('occurred_at', 'desc');

        // Filter by product
        if ($request->filled('product_id')) {
            $query->where('product_id', $request->integer('product_id'));
        }

        // Filter by type
        if ($request->filled('movement_type')) {
            $query->where('movement_type', $request->input('movement_type'));
        }

        // Filter by date range
        if ($request->filled('from')) {
            $query->whereDate('occurred_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('occurred_at', '<=', $request->input('to'));
        }

        $movements = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => StockMovementResource::collection($movements->items()),
            'meta'    => [
                'current_page' => $movements->currentPage(),
                'last_page'    => $movements->lastPage(),
                'per_page'     => $movements->perPage(),
                'total'        => $movements->total(),
            ],
            'message' => 'Stock movements retrieved successfully.',
        ]);
    }

    /**
     * POST /api/v1/stock/adjust/{product}
     * Manually adjust product stock (stock-in, stock-out, or general adjustment).
     * EnsureShopAccess middleware handles tenant verification on the $product binding.
     */
    public function adjust(AdjustStockRequest $request, Product $product): JsonResponse
    {
        $movementType = $request->validated('movement_type');
        $quantity     = (float) $request->validated('quantity');
        $unitCost     = $request->validated('unit_cost') !== null
            ? (float) $request->validated('unit_cost')
            : null;
        $notes    = $request->validated('notes');
        $userId   = $request->user()->id;

        // Determine signed delta
        $delta = match ($movementType) {
            'stock_in'   => abs($quantity),
            'stock_out'  => -abs($quantity),
            'adjustment' => $quantity, // signed: caller provides positive or negative
            default      => abs($quantity),
        };

        try {
            $movement = $this->stockService->applyDelta(
                product:      $product,
                delta:        $delta,
                movementType: $movementType,
                userId:       $userId,
                unitCost:     $unitCost,
                notes:        $notes,
            );

            $movement->load(['product', 'user']);

            return $this->created(
                new StockMovementResource($movement),
                'Stock adjustment applied successfully.',
            );
        } catch (InsufficientStockException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    /**
     * GET /api/v1/stock/valuation
     * Returns overall stock valuation and alert counts for the shop.
     */
    public function valuation(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $totalValue = (float) Product::where('shop_id', $shopId)
            ->selectRaw('COALESCE(SUM(buying_price * quantity), 0) as value')
            ->value('value');

        $totalProducts = Product::where('shop_id', $shopId)->count();

        $lowStockCount = Product::where('shop_id', $shopId)
            ->whereColumn('quantity', '<=', 'reorder_level')
            ->count();

        $outOfStockCount = Product::where('shop_id', $shopId)
            ->where('quantity', '<=', 0)
            ->count();

        $expiringSoonCount = Product::where('shop_id', $shopId)
            ->whereBetween('expiry_date', [
                now()->toDateString(),
                now()->addDays(7)->toDateString(),
            ])
            ->count();

        return $this->success([
            'totalValue'        => $totalValue,
            'totalProducts'     => $totalProducts,
            'lowStockCount'     => $lowStockCount,
            'outOfStockCount'   => $outOfStockCount,
            'expiringSoonCount' => $expiringSoonCount,
        ], 'Stock valuation retrieved successfully.');
    }
}
