<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/ProductController.php
// Purpose: Full CRUD for the shop's product catalogue — owner and manager only.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Product\StoreProductRequest;
use App\Http\Requests\Api\V1\Product\UpdateProductRequest;
use App\Http\Resources\Api\V1\ProductResource;
use App\Models\Product;
use App\Models\StockMovement;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/v1/products
     * Returns a paginated list of products for the shop with metadata logs.
     */
    public function index(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;
        $perPage = $request->integer('per_page', 50);

        $query = Product::query()
            ->where('shop_id', $shopId)
            ->with(['category', 'supplier']);

        // Search filter (parameterized LIKE)
        if ($request->filled('search')) {
            $search = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', $search)
                  ->orWhere('sku', 'LIKE', $search)
                  ->orWhere('barcode', 'LIKE', $search);
            });
        }

        // Category filter
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->input('category_id'));
        }

        // Low stock filter
        if ($request->boolean('low_stock')) {
            $query->whereColumn('quantity', '<=', 'reorder_level');
        }

        // Expiring soon filter (within 7 days)
        if ($request->boolean('expiring_soon')) {
            $now = Carbon::today();
            $target = Carbon::today()->addDays(7);
            $query->whereBetween('expiry_date', [$now, $target]);
        }

        // Status filter
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Paginate results
        $products = $query->paginate($perPage);

        // Aggregate Metadata calculation
        // Total products count
        $total = Product::where('shop_id', $shopId)->count();

        // Low Stock Count
        $lowStockCount = Product::where('shop_id', $shopId)
            ->whereColumn('quantity', '<=', 'reorder_level')
            ->count();

        // Expiring soon count
        $expiringSoonCount = Product::where('shop_id', $shopId)
            ->whereBetween('expiry_date', [Carbon::today(), Carbon::today()->addDays(7)])
            ->count();

        // Total Stock Value (buying_price * quantity)
        $totalStockValue = (float) Product::where('shop_id', $shopId)
            ->selectRaw('SUM(buying_price * quantity) as value')
            ->value('value') ?? 0.00;

        return response()->json([
            'success' => true,
            'data' => ProductResource::collection($products->items()),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
                'total' => $products->total(),
                'lowStockCount' => $lowStockCount,
                'expiringSoonCount' => $expiringSoonCount,
                'totalStockValue' => $totalStockValue,
            ],
            'message' => 'Products retrieved successfully.',
        ]);
    }

    /**
     * POST /api/v1/products
     * Create a new product.
     */
    public function store(StoreProductRequest $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $product = Product::create(array_merge($request->validated(), [
            'shop_id' => $shopId,
        ]));

        $product->load(['category', 'supplier']);

        return $this->created(
            new ProductResource($product),
            'Product created successfully.',
        );
    }

    /**
     * GET /api/v1/products/{product}
     * Retrieve a specific product. EnsureShopAccess handles tenant checks.
     */
    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'supplier']);

        return $this->success(
            new ProductResource($product),
            'Product retrieved successfully.',
        );
    }

    /**
     * PUT /api/v1/products/{product}
     * Update an existing product. Ensures audit trail for manual quantity updates.
     */
    public function update(UpdateProductRequest $request, Product $product): JsonResponse
    {
        $oldQty = (float) $product->quantity;
        $newQty = $request->has('quantity') ? (float) $request->input('quantity') : null;

        DB::transaction(function () use ($request, $product, $oldQty, $newQty) {
            $product->update($request->validated());

            // Audit trail for manual quantity adjustments
            if ($newQty !== null && $newQty !== $oldQty) {
                $delta = $newQty - $oldQty;

                StockMovement::create([
                    'uuid' => (string) Str::uuid(),
                    'shop_id' => $product->shop_id,
                    'product_id' => $product->id,
                    'user_id' => $request->user()->id,
                    'movement_type' => 'adjustment',
                    'delta' => $delta,
                    'quantity_before' => $oldQty,
                    'quantity_after' => $newQty,
                    'notes' => 'Manual inventory direct adjustment.',
                    'occurred_at' => Carbon::now(),
                ]);
            }
        });

        $product->load(['category', 'supplier']);

        return $this->success(
            new ProductResource($product),
            'Product updated successfully.',
        );
    }

    /**
     * DELETE /api/v1/products/{product}
     * Soft delete product. Prevent hard delete if sales/movements history exists.
     */
    public function destroy(Product $product): JsonResponse
    {
        // If product has any stock movements, soft delete handles it perfectly.
        // Eloquent SoftDeletes is loaded in Product model.
        $product->delete();

        return $this->noContent();
    }

    /**
     * GET /api/v1/products/barcode/{barcode}
     * SmartScan speed-critical endpoint. Target < 50ms. No joins, flat product data only.
     */
    public function findByBarcode(Request $request, string $barcode): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $product = Product::where('shop_id', $shopId)
            ->where('barcode', $barcode)
            ->where('is_active', true)
            ->first();

        if (! $product) {
            return $this->notFound('Product with specified barcode not found.');
        }

        // Return flat resource without loading relations for sub-50ms speed
        return $this->success(
            new ProductResource($product),
            'Product found successfully.',
        );
    }
}
