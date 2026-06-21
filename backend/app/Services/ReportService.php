<?php

// backend/app/Services/ReportService.php
// Purpose: Aggregation queries for dashboard, sales, stock, profit, attendant and expense reports.
//          All queries are scoped to a single shop and never cross tenant boundaries.

namespace App\Services;

use App\DTOs\Reports\AttendantPerformanceDTO;
use App\DTOs\Reports\DailyRevenuePointDTO;
use App\DTOs\Reports\DashboardSummaryDTO;
use App\DTOs\Reports\ExpenseCategoryDTO;
use App\DTOs\Reports\ExpenseReportDTO;
use App\DTOs\Reports\PaymentBreakdownDTO;
use App\DTOs\Reports\ProfitProductDTO;
use App\DTOs\Reports\ProfitReportDTO;
use App\DTOs\Reports\RecentTransactionDTO;
use App\DTOs\Reports\SalesReportDTO;
use App\DTOs\Reports\StockReportDTO;
use App\DTOs\Reports\StockReportItemDTO;
use App\DTOs\Reports\TopProductDTO;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    /**
     * Dashboard summary — today's metrics.
     * Used for the KPI cards at the top of the owner/manager dashboard.
     */
    public function dashboardSummary(int $shopId): DashboardSummaryDTO
    {
        $todayStart = Carbon::today()->startOfDay();
        $todayEnd = Carbon::today()->endOfDay();
        $yesterdayStart = Carbon::yesterday()->startOfDay();
        $yesterdayEnd = Carbon::yesterday()->endOfDay();

        // 1. Today's stats
        $todayStats = DB::table('sales')
            ->selectRaw('COALESCE(SUM(total_amount), 0) as revenue, COUNT(id) as order_count')
            ->where('shop_id', $shopId)
            ->where('status', 'completed')
            ->whereBetween('sold_at', [$todayStart, $todayEnd])
            ->first();

        $todayRevenue = (float) $todayStats->revenue;
        $todayOrderCount = (int) $todayStats->order_count;

        // COGS today
        $todayCogs = (float) DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.shop_id', $shopId)
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$todayStart, $todayEnd])
            ->sum(DB::raw('sale_items.buying_price * sale_items.quantity'));

        $todayProfit = $todayRevenue - $todayCogs;
        $todayProfitMargin = $todayRevenue > 0 ? ($todayProfit / $todayRevenue) * 100 : 0.0;

        // 2. Yesterday's stats
        $yesterdayStats = DB::table('sales')
            ->selectRaw('COALESCE(SUM(total_amount), 0) as revenue, COUNT(id) as order_count')
            ->where('shop_id', $shopId)
            ->where('status', 'completed')
            ->whereBetween('sold_at', [$yesterdayStart, $yesterdayEnd])
            ->first();

        $yesterdayRevenue = (float) $yesterdayStats->revenue;
        $yesterdayOrderCount = (int) $yesterdayStats->order_count;

        // Compare percentage change
        $revenueChange = 0.0;
        if ($yesterdayRevenue > 0) {
            $revenueChange = (($todayRevenue - $yesterdayRevenue) / $yesterdayRevenue) * 100;
        } elseif ($todayRevenue > 0) {
            $revenueChange = 100.0;
        }

        $orderCountChange = 0.0;
        if ($yesterdayOrderCount > 0) {
            $orderCountChange = (($todayOrderCount - $yesterdayOrderCount) / $yesterdayOrderCount) * 100;
        } elseif ($todayOrderCount > 0) {
            $orderCountChange = 100.0;
        }

        // 3. Stock counts
        $lowStockCount = DB::table('products')
            ->where('shop_id', $shopId)
            ->whereNull('deleted_at')
            ->whereRaw('quantity <= reorder_level')
            ->count();

        $outOfStockCount = DB::table('products')
            ->where('shop_id', $shopId)
            ->whereNull('deleted_at')
            ->where('quantity', '<=', 0)
            ->count();

        $expiringSoonCount = DB::table('products')
            ->where('shop_id', $shopId)
            ->whereNull('deleted_at')
            ->whereNotNull('expiry_date')
            ->whereBetween('expiry_date', [Carbon::today(), Carbon::today()->addDays(30)])
            ->count();

        // 4. Top 5 products today
        $topProductsRaw = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->leftJoin('products', 'products.id', '=', 'sale_items.product_id')
            ->select(
                'sale_items.product_id',
                'sale_items.product_name as name',
                'products.uuid as product_uuid',
                'products.image_url',
                DB::raw('SUM(sale_items.total) as revenue'),
                DB::raw('SUM(sale_items.quantity) as units_sold')
            )
            ->where('sales.shop_id', $shopId)
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$todayStart, $todayEnd])
            ->groupBy('sale_items.product_id', 'sale_items.product_name', 'products.uuid', 'products.image_url')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get();

        $topProductsToday = [];
        foreach ($topProductsRaw as $p) {
            $topProductsToday[] = new TopProductDTO(
                productId: $p->product_uuid ?? (string) $p->product_id,
                name: $p->name,
                imageUrl: $p->image_url,
                revenue: (float) $p->revenue,
                unitsSold: (float) $p->units_sold
            );
        }

        // 5. Recent 10 transactions
        $recentTransactionsRaw = DB::table('sales')
            ->join('users', 'users.id', '=', 'sales.user_id')
            ->select(
                'sales.uuid as sale_uuid',
                'sales.receipt_number',
                'users.name as cashier_name',
                'sales.total_amount',
                'sales.payment_method',
                'sales.status',
                'sales.sold_at'
            )
            ->where('sales.shop_id', $shopId)
            ->orderByDesc('sales.sold_at')
            ->limit(10)
            ->get();

        $recentTransactions = [];
        foreach ($recentTransactionsRaw as $t) {
            $recentTransactions[] = new RecentTransactionDTO(
                saleId: $t->sale_uuid,
                receiptNumber: $t->receipt_number,
                cashierName: $t->cashier_name,
                totalAmount: (float) $t->total_amount,
                paymentMethod: $t->payment_method,
                status: $t->status,
                soldAt: Carbon::parse($t->sold_at)->toIso8601String()
            );
        }

        return new DashboardSummaryDTO(
            todayRevenue: $todayRevenue,
            todayOrderCount: $todayOrderCount,
            todayProfit: $todayProfit,
            todayProfitMargin: round($todayProfitMargin, 2),
            lowStockCount: $lowStockCount,
            outOfStockCount: $outOfStockCount,
            expiringSoonCount: $expiringSoonCount,
            topProductsToday: $topProductsToday,
            recentTransactions: $recentTransactions,
            revenueChange: round($revenueChange, 2),
            orderCountChange: round($orderCountChange, 2)
        );
    }

    /**
     * Sales report — aggregated by day, week, or month.
     */
    public function salesReport(
        int $shopId,
        Carbon $from,
        Carbon $to,
        string $groupBy = 'day'
    ): SalesReportDTO {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();

        // 1. Overall stats
        $overallStats = DB::table('sales')
            ->selectRaw('COALESCE(SUM(total_amount), 0) as revenue, COUNT(id) as order_count')
            ->where('shop_id', $shopId)
            ->where('status', 'completed')
            ->whereBetween('sold_at', [$start, $end])
            ->first();

        $totalRevenue = (float) $overallStats->revenue;
        $totalOrders = (int) $overallStats->order_count;
        $averageOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0.0;

        // Total COGS
        $totalCogs = (float) DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.shop_id', $shopId)
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$start, $end])
            ->sum(DB::raw('sale_items.buying_price * sale_items.quantity'));

        $totalProfit = $totalRevenue - $totalCogs;

        // 2. Group by daily revenue trend points using PostgreSQL DATE_TRUNC
        $groupByField = match ($groupBy) {
            'week' => "DATE_TRUNC('week', sales.sold_at)",
            'month' => "DATE_TRUNC('month', sales.sold_at)",
            default => "DATE_TRUNC('day', sales.sold_at)",
        };

        $cogsSub = DB::table('sale_items')
            ->select('sale_id', DB::raw('SUM(buying_price * quantity) as total_cost'))
            ->groupBy('sale_id');

        $pointsRaw = DB::table('sales')
            ->leftJoinSub($cogsSub, 'cogs', 'cogs.sale_id', '=', 'sales.id')
            ->select(
                DB::raw("{$groupByField} as period"),
                DB::raw('SUM(sales.total_amount) as revenue'),
                DB::raw('COUNT(sales.id) as order_count'),
                DB::raw('SUM(sales.total_amount - COALESCE(cogs.total_cost, 0)) as profit')
            )
            ->where('sales.shop_id', $shopId)
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$start, $end])
            ->groupBy(DB::raw($groupByField))
            ->orderBy('period', 'asc')
            ->get();

        $dataPoints = [];
        foreach ($pointsRaw as $p) {
            $dataPoints[] = new DailyRevenuePointDTO(
                date: Carbon::parse($p->period)->toDateString(),
                revenue: (float) $p->revenue,
                orderCount: (int) $p->order_count,
                profit: (float) $p->profit
            );
        }

        // 3. Payment breakdown
        $paymentBreakdown = $this->paymentBreakdown($shopId, $from, $to);

        return new SalesReportDTO(
            from: $from->toDateString(),
            to: $to->toDateString(),
            totalRevenue: $totalRevenue,
            totalOrders: $totalOrders,
            totalProfit: $totalProfit,
            averageOrderValue: round($averageOrderValue, 2),
            dataPoints: $dataPoints,
            paymentBreakdown: $paymentBreakdown
        );
    }

    /**
     * Payment method breakdown for a period.
     */
    public function paymentBreakdown(int $shopId, Carbon $from, Carbon $to): PaymentBreakdownDTO
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();

        $paymentStats = DB::table('sales')
            ->select('payment_method', DB::raw('SUM(total_amount) as total'))
            ->where('shop_id', $shopId)
            ->where('status', 'completed')
            ->whereBetween('sold_at', [$start, $end])
            ->groupBy('payment_method')
            ->pluck('total', 'payment_method')
            ->toArray();

        $cash = (float) ($paymentStats['cash'] ?? 0.0);
        $mpesa = (float) ($paymentStats['mpesa'] ?? 0.0);
        $bank = (float) ($paymentStats['bank'] ?? 0.0);
        $mixed = (float) ($paymentStats['mixed'] ?? 0.0);

        $total = $cash + $mpesa + $bank + $mixed;

        $cashPercentage = $total > 0 ? ($cash / $total) * 100 : 0.0;
        $mpesaPercentage = $total > 0 ? ($mpesa / $total) * 100 : 0.0;
        $bankPercentage = $total > 0 ? ($bank / $total) * 100 : 0.0;
        $mixedPercentage = $total > 0 ? ($mixed / $total) * 100 : 0.0;

        return new PaymentBreakdownDTO(
            cash: $cash,
            mpesa: $mpesa,
            bank: $bank,
            mixed: $mixed,
            cashPercentage: round($cashPercentage, 2),
            mpesaPercentage: round($mpesaPercentage, 2),
            bankPercentage: round($bankPercentage, 2),
            mixedPercentage: round($mixedPercentage, 2)
        );
    }

    /**
     * Profit report — owner only.
     * Revenue minus buying cost of goods sold.
     */
    public function profitReport(int $shopId, Carbon $from, Carbon $to): ProfitReportDTO
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();

        // 1. Gross revenue
        $grossRevenue = (float) DB::table('sales')
            ->where('shop_id', $shopId)
            ->where('status', 'completed')
            ->whereBetween('sold_at', [$start, $end])
            ->sum('total_amount');

        // 2. Cost of goods sold (COGS)
        $costOfGoodsSold = (float) DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->where('sales.shop_id', $shopId)
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$start, $end])
            ->sum(DB::raw('sale_items.buying_price * sale_items.quantity'));

        $grossProfit = $grossRevenue - $costOfGoodsSold;
        $grossMargin = $grossRevenue > 0 ? ($grossProfit / $grossRevenue) * 100 : 0.0;

        // 3. Top profit products
        $topProfitProductsRaw = DB::table('sale_items')
            ->join('sales', 'sales.id', '=', 'sale_items.sale_id')
            ->leftJoin('products', 'products.id', '=', 'sale_items.product_id')
            ->select(
                'sale_items.product_id',
                'sale_items.product_name as name',
                'products.uuid as product_uuid',
                DB::raw('SUM(sale_items.total) as revenue'),
                DB::raw('SUM(sale_items.buying_price * sale_items.quantity) as cogs')
            )
            ->where('sales.shop_id', $shopId)
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$start, $end])
            ->groupBy('sale_items.product_id', 'sale_items.product_name', 'products.uuid')
            ->get();

        $topProfitProducts = [];
        foreach ($topProfitProductsRaw as $p) {
            $revenue = (float) $p->revenue;
            $cogs = (float) $p->cogs;
            $profit = $revenue - $cogs;
            $margin = $revenue > 0 ? ($profit / $revenue) * 100 : 0.0;

            $topProfitProducts[] = new ProfitProductDTO(
                productId: $p->product_uuid ?? (string) $p->product_id,
                name: $p->name,
                revenue: $revenue,
                cogs: $cogs,
                profit: $profit,
                margin: round($margin, 2)
            );
        }

        // Sort descending by profit, get top 10
        usort($topProfitProducts, fn($a, $b) => $b->profit <=> $a->profit);
        $topProfitProducts = array_slice($topProfitProducts, 0, 10);

        // 4. Daily profit trend
        $dailyCogsSub = DB::table('sale_items')
            ->select('sale_id', DB::raw('SUM(buying_price * quantity) as total_cost'))
            ->groupBy('sale_id');

        $dailyProfitRaw = DB::table('sales')
            ->leftJoinSub($dailyCogsSub, 'cogs', 'cogs.sale_id', '=', 'sales.id')
            ->select(
                DB::raw("DATE_TRUNC('day', sales.sold_at) as period"),
                DB::raw('SUM(sales.total_amount) as revenue'),
                DB::raw('COUNT(sales.id) as order_count'),
                DB::raw('SUM(sales.total_amount - COALESCE(cogs.total_cost, 0)) as profit')
            )
            ->where('sales.shop_id', $shopId)
            ->where('sales.status', 'completed')
            ->whereBetween('sales.sold_at', [$start, $end])
            ->groupBy(DB::raw("DATE_TRUNC('day', sales.sold_at)"))
            ->orderBy('period', 'asc')
            ->get();

        $dailyProfit = [];
        foreach ($dailyProfitRaw as $dp) {
            $dailyProfit[] = new DailyRevenuePointDTO(
                date: Carbon::parse($dp->period)->toDateString(),
                revenue: (float) $dp->revenue,
                orderCount: (int) $dp->order_count,
                profit: (float) $dp->profit
            );
        }

        return new ProfitReportDTO(
            from: $from->toDateString(),
            to: $to->toDateString(),
            grossRevenue: $grossRevenue,
            costOfGoodsSold: $costOfGoodsSold,
            grossProfit: $grossProfit,
            grossMargin: round($grossMargin, 2),
            topProfitProducts: $topProfitProducts,
            dailyProfit: $dailyProfit
        );
    }

    /**
     * Attendant performance report.
     */
    public function attendantReport(int $shopId, Carbon $from, Carbon $to): array
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();

        $cashiers = DB::table('sales')
            ->join('users', 'users.id', '=', 'sales.user_id')
            ->select(
                'users.uuid as user_uuid',
                'users.name',
                DB::raw("SUM(CASE WHEN sales.status = 'completed' THEN sales.total_amount ELSE 0 END) as revenue"),
                DB::raw("COUNT(CASE WHEN sales.status = 'completed' THEN sales.id ELSE NULL END) as sales_count"),
                DB::raw("COUNT(CASE WHEN sales.status = 'voided' THEN sales.id ELSE NULL END) as void_count")
            )
            ->where('sales.shop_id', $shopId)
            ->whereBetween('sales.sold_at', [$start, $end])
            ->groupBy('users.uuid', 'users.name')
            ->get();

        $reports = [];
        foreach ($cashiers as $c) {
            $salesCount = (int) $c->sales_count;
            $voidCount = (int) $c->void_count;
            $totalRevenue = (float) $c->revenue;

            $voidRate = ($salesCount + $voidCount) > 0
                ? ($voidCount / ($salesCount + $voidCount)) * 100
                : 0.0;

            $averageOrderValue = $salesCount > 0 ? $totalRevenue / $salesCount : 0.0;

            $reports[] = new AttendantPerformanceDTO(
                userId: $c->user_uuid,
                name: $c->name,
                salesCount: $salesCount,
                totalRevenue: $totalRevenue,
                voidCount: $voidCount,
                voidRate: round($voidRate, 2),
                averageOrderValue: round($averageOrderValue, 2)
            );
        }

        return $reports;
    }

    /**
     * Stock valuation and summary.
     */
    public function stockReport(int $shopId): StockReportDTO
    {
        $productsRaw = DB::table('products')
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->select(
                'products.uuid as product_uuid',
                'products.name',
                'products.sku',
                'categories.name as category_name',
                'products.quantity',
                'products.reorder_level',
                'products.unit',
                'products.buying_price',
                'products.selling_price',
                'products.expiry_date'
            )
            ->where('products.shop_id', $shopId)
            ->whereNull('products.deleted_at')
            ->get();

        $totalValue = 0.0;
        $totalProducts = 0;
        $lowStockCount = 0;
        $outOfStockCount = 0;
        $expiringSoonCount = 0;
        $items = [];

        $today = Carbon::today();
        $expiryThreshold = Carbon::today()->addDays(30);

        foreach ($productsRaw as $p) {
            $qty = (float) $p->quantity;
            $reorder = (float) $p->reorder_level;
            $buyingPrice = (float) $p->buying_price;
            $sellingPrice = (float) $p->selling_price;
            $itemValue = $buyingPrice * $qty;

            $totalValue += $itemValue;
            $totalProducts++;

            if ($qty <= 0) {
                $status = 'out_of_stock';
                $outOfStockCount++;
            } elseif ($qty <= $reorder) {
                $status = 'low_stock';
                $lowStockCount++;
            } else {
                $status = 'in_stock';
            }

            if ($p->expiry_date) {
                $expiry = Carbon::parse($p->expiry_date);
                if ($expiry->betweenInclusive($today, $expiryThreshold)) {
                    $expiringSoonCount++;
                }
            }

            $items[] = new StockReportItemDTO(
                productId: $p->product_uuid,
                name: $p->name,
                sku: $p->sku,
                categoryName: $p->category_name,
                quantity: $qty,
                reorderLevel: $reorder,
                unit: $p->unit,
                status: $status,
                buyingPrice: $buyingPrice,
                sellingPrice: $sellingPrice,
                stockValue: $itemValue
            );
        }

        return new StockReportDTO(
            totalValue: $totalValue,
            totalProducts: $totalProducts,
            lowStockCount: $lowStockCount,
            outOfStockCount: $outOfStockCount,
            expiringSoonCount: $expiringSoonCount,
            items: $items
        );
    }

    /**
     * Expense summary by category for a period.
     */
    public function expenseReport(int $shopId, Carbon $from, Carbon $to): ExpenseReportDTO
    {
        $start = $from->copy()->startOfDay();
        $end = $to->copy()->endOfDay();

        $expenseStats = DB::table('expenses')
            ->select('category', DB::raw('SUM(amount) as total'), DB::raw('COUNT(id) as count'))
            ->where('shop_id', $shopId)
            ->whereNull('deleted_at')
            ->whereBetween('expense_date', [$start, $end])
            ->groupBy('category')
            ->get();

        $totalExpenses = 0.0;
        $categoryCounts = [];
        $categoryTotals = [];

        // Initialize all categories with 0 values
        $allowedCategories = ['rent', 'salary', 'electricity', 'internet', 'transport', 'maintenance', 'other'];
        foreach ($allowedCategories as $cat) {
            $categoryTotals[$cat] = 0.0;
            $categoryCounts[$cat] = 0;
        }

        foreach ($expenseStats as $stat) {
            $cat = $stat->category;
            if (in_array($cat, $allowedCategories)) {
                $tot = (float) $stat->total;
                $categoryTotals[$cat] = $tot;
                $categoryCounts[$cat] = (int) $stat->count;
                $totalExpenses += $tot;
            }
        }

        $byCategory = [];
        foreach ($allowedCategories as $cat) {
            $tot = $categoryTotals[$cat];
            $pct = $totalExpenses > 0 ? ($tot / $totalExpenses) * 100 : 0.0;

            $byCategory[] = new ExpenseCategoryDTO(
                category: $cat,
                total: $tot,
                count: $categoryCounts[$cat],
                percentage: round($pct, 2)
            );
        }

        return new ExpenseReportDTO(
            from: $from->toDateString(),
            to: $to->toDateString(),
            totalExpenses: $totalExpenses,
            byCategory: $byCategory
        );
    }
}
