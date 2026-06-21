<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/ReportController.php
// Purpose: Report endpoints — all scoped to authenticated user's shop.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    use ApiResponse;

    protected ReportService $reportService;

    public function __construct(ReportService $reportService)
    {
        $this->reportService = $reportService;
    }

    /**
     * GET /api/v1/reports/dashboard
     * Dashboard summary — today's metrics. Cache with Redis for 60 seconds.
     */
    public function dashboard(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;
        $cacheKey = "report:dashboard:{$shopId}";

        $data = Cache::remember($cacheKey, 60, function () use ($shopId) {
            return $this->reportService->dashboardSummary($shopId)->toArray();
        });

        return $this->success($data, 'Today dashboard summary retrieved successfully.');
    }

    /**
     * GET /api/v1/reports/sales
     * Sales report — aggregated by day, week, or month. Cache with Redis for 5 minutes.
     */
    public function sales(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
            'group_by' => 'nullable|string|in:day,week,month',
        ]);

        $from = Carbon::parse($request->input('from'));
        $to = Carbon::parse($request->input('to'));
        $groupBy = $request->input('group_by', 'day');

        if ($from->diffInDays($to) > 366) {
            return response()->json([
                'success' => false,
                'message' => 'Date range cannot exceed 366 days.'
            ], 422);
        }

        $shopId = $request->user()->shop_id;
        $cacheKey = "report:sales:{$shopId}:{$from->toDateString()}:{$to->toDateString()}:{$groupBy}";

        $data = Cache::remember($cacheKey, 300, function () use ($shopId, $from, $to, $groupBy) {
            return $this->reportService->salesReport($shopId, $from, $to, $groupBy)->toArray();
        });

        return $this->success($data, 'Sales report retrieved successfully.');
    }

    /**
     * GET /api/v1/reports/profit
     * Profit report — owner only.
     */
    public function profit(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $from = Carbon::parse($request->input('from'));
        $to = Carbon::parse($request->input('to'));

        $shopId = $request->user()->shop_id;
        $data = $this->reportService->profitReport($shopId, $from, $to)->toArray();

        return $this->success($data, 'Profit report retrieved successfully.');
    }

    /**
     * GET /api/v1/reports/attendants
     * Attendant performance report.
     */
    public function attendants(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $from = Carbon::parse($request->input('from'));
        $to = Carbon::parse($request->input('to'));

        $shopId = $request->user()->shop_id;
        $data = $this->reportService->attendantReport($shopId, $from, $to);
        $data = array_map(fn($item) => $item->toArray(), $data);

        return $this->success($data, 'Attendant report retrieved successfully.');
    }

    /**
     * GET /api/v1/reports/stock
     * Stock valuation and movement summary. Cache 5 minutes.
     */
    public function stock(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;
        $cacheKey = "report:stock:{$shopId}";

        $data = Cache::remember($cacheKey, 300, function () use ($shopId) {
            return $this->reportService->stockReport($shopId)->toArray();
        });

        return $this->success($data, 'Stock report retrieved successfully.');
    }

    /**
     * GET /api/v1/reports/expenses
     * Expense summary by category.
     */
    public function expenses(Request $request): JsonResponse
    {
        $request->validate([
            'from' => 'required|date',
            'to' => 'required|date|after_or_equal:from',
        ]);

        $from = Carbon::parse($request->input('from'));
        $to = Carbon::parse($request->input('to'));

        $shopId = $request->user()->shop_id;
        $data = $this->reportService->expenseReport($shopId, $from, $to)->toArray();

        return $this->success($data, 'Expense report retrieved successfully.');
    }

    /**
     * GET /api/v1/reports/export
     * Streams a CSV of the requested report type for the given date range.
     */
    public function export(Request $request): StreamedResponse
    {
        $request->validate([
            'type' => 'required|string|in:sales,stock,expenses',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $type = $request->input('type');
        $from = $request->filled('from') ? Carbon::parse($request->input('from')) : Carbon::today()->subMonth();
        $to = $request->filled('to') ? Carbon::parse($request->input('to')) : Carbon::today();
        $shopId = $request->user()->shop_id;

        $fileName = "smartkiosk-{$type}-" . Carbon::now()->toDateString() . ".csv";

        $response = new StreamedResponse(function () use ($shopId, $type, $from, $to) {
            $handle = fopen('php://output', 'w');

            if ($type === 'sales') {
                fputcsv($handle, ['Date', 'Revenue', 'Order Count', 'Profit']);
                $report = $this->reportService->salesReport($shopId, $from, $to, 'day');
                foreach ($report->dataPoints as $point) {
                    fputcsv($handle, [
                        $point->date,
                        $point->revenue,
                        $point->orderCount,
                        $point->profit,
                    ]);
                }
            } elseif ($type === 'stock') {
                fputcsv($handle, ['Product ID', 'Name', 'SKU', 'Category', 'Quantity', 'Reorder Level', 'Unit', 'Status', 'Buying Price', 'Selling Price', 'Stock Value']);
                $report = $this->reportService->stockReport($shopId);
                foreach ($report->items as $item) {
                    fputcsv($handle, [
                        $item->productId,
                        $item->name,
                        $item->sku,
                        $item->categoryName,
                        $item->quantity,
                        $item->reorderLevel,
                        $item->unit,
                        $item->status,
                        $item->buyingPrice,
                        $item->sellingPrice,
                        $item->stockValue,
                    ]);
                }
            } elseif ($type === 'expenses') {
                fputcsv($handle, ['Category', 'Total Amount', 'Transaction Count', 'Percentage of Total']);
                $report = $this->reportService->expenseReport($shopId, $from, $to);
                foreach ($report->byCategory as $cat) {
                    fputcsv($handle, [
                        $cat->category,
                        $cat->total,
                        $cat->count,
                        $cat->percentage,
                    ]);
                }
            }

            fclose($handle);
        });

        $response->headers->set('Content-Type', 'text/csv');
        $response->headers->set('Content-Disposition', "attachment; filename=\"{$fileName}\"");

        return $response;
    }
}
