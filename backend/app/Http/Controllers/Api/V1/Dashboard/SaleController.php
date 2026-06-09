<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/SaleController.php
// Purpose: Handles sale transaction endpoints — index, store, show, void.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Sale\StoreSaleRequest;
use App\Http\Resources\Api\V1\SaleResource;
use App\Models\Sale;
use App\Services\SaleService;
use App\Traits\ApiResponse;
use App\Events\SaleCreatedEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SaleController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly SaleService $saleService
    ) {}

    /**
     * GET /api/v1/sales
     * Returns a paginated list of sales for the shop.
     */
    public function index(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;
        $perPage = $request->integer('per_page', 50);

        $query = Sale::query()
            ->where('shop_id', $shopId)
            ->with('items')
            ->orderBy('sold_at', 'desc');

        // Search on receipt number
        if ($request->filled('search')) {
            $query->where('receipt_number', 'LIKE', '%' . $request->input('search') . '%');
        }

        // Filter by status (completed, voided, refunded)
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filter by date range (sold_at)
        if ($request->filled('start_date')) {
            $query->whereDate('sold_at', '>=', Carbon::parse($request->input('start_date')));
        }
        if ($request->filled('end_date')) {
            $query->whereDate('sold_at', '<=', Carbon::parse($request->input('end_date')));
        }

        $sales = $query->paginate($perPage);

        // Calculate metadata totals (gross revenue, transactions count)
        $totalRevenue = (float) Sale::where('shop_id', $shopId)
            ->where('status', 'completed')
            ->sum('total_amount');

        return response()->json([
            'success' => true,
            'data' => SaleResource::collection($sales->items()),
            'meta' => [
                'current_page' => $sales->currentPage(),
                'last_page' => $sales->lastPage(),
                'per_page' => $sales->perPage(),
                'total' => $sales->total(),
                'totalRevenue' => $totalRevenue,
            ],
            'message' => 'Sales retrieved successfully.',
        ]);
    }

    /**
     * POST /api/v1/sales
     * Process/create a new sale.
     */
    public function store(StoreSaleRequest $request): JsonResponse
    {
        $cashier = $request->user();
        
        $sale = $this->saleService->processSale($request->validated(), $cashier);

        // Broadcast to channels
        broadcast(new SaleCreatedEvent($sale))->toOthers();

        return $this->created(
            new SaleResource($sale),
            'Sale completed successfully.',
        );
    }

    /**
     * GET /api/v1/sales/{sale}
     */
    public function show(Sale $sale): JsonResponse
    {
        $sale->load('items');

        return $this->success(
            new SaleResource($sale),
            'Sale retrieved successfully.',
        );
    }

    /**
     * POST /api/v1/sales/{sale}/void
     */
    public function void(Request $request, Sale $sale): JsonResponse
    {
        $actor = $request->user();

        // Enforce cashier cannot void sales — only managers or owners
        if (!$actor->hasAnyRole(['manager', 'owner'])) {
            return response()->json([
                'success' => false,
                'message' => 'Only managers or owners are authorized to void sales.',
            ], 403);
        }

        $voidedSale = $this->saleService->voidSale($sale, $actor);

        return $this->success(
            new SaleResource($voidedSale),
            'Sale voided successfully.',
        );
    }
}
