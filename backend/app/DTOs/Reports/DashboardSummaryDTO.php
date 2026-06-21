<?php

// backend/app/DTOs/Reports/DashboardSummaryDTO.php
// Purpose: DTO representing today's metrics for the dashboard view.

namespace App\DTOs\Reports;

readonly class DashboardSummaryDTO
{
    /**
     * @param TopProductDTO[] $topProductsToday
     * @param RecentTransactionDTO[] $recentTransactions
     */
    public function __construct(
        public float $todayRevenue,
        public int $todayOrderCount,
        public float $todayProfit,
        public float $todayProfitMargin,
        public int $lowStockCount,
        public int $outOfStockCount,
        public int $expiringSoonCount,
        public array $topProductsToday,
        public array $recentTransactions,
        public float $revenueChange,
        public float $orderCountChange
    ) {}

    public function toArray(): array
    {
        return [
            'todayRevenue' => $this->todayRevenue,
            'todayOrderCount' => $this->todayOrderCount,
            'todayProfit' => $this->todayProfit,
            'todayProfitMargin' => $this->todayProfitMargin,
            'lowStockCount' => $this->lowStockCount,
            'outOfStockCount' => $this->outOfStockCount,
            'expiringSoonCount' => $this->expiringSoonCount,
            'topProductsToday' => array_map(fn(TopProductDTO $p) => $p->toArray(), $this->topProductsToday),
            'recentTransactions' => array_map(fn(RecentTransactionDTO $t) => $t->toArray(), $this->recentTransactions),
            'comparedToYesterday' => [
                'revenueChange' => $this->revenueChange,
                'orderCountChange' => $this->orderCountChange,
            ],
        ];
    }
}
