<?php

// backend/app/DTOs/Reports/SalesReportDTO.php
// Purpose: DTO representing aggregated sales report details.

namespace App\DTOs\Reports;

readonly class SalesReportDTO
{
    /**
     * @param DailyRevenuePointDTO[] $dataPoints
     */
    public function __construct(
        public string $from,
        public string $to,
        public float $totalRevenue,
        public int $totalOrders,
        public float $totalProfit,
        public float $averageOrderValue,
        public array $dataPoints,
        public PaymentBreakdownDTO $paymentBreakdown
    ) {}

    public function toArray(): array
    {
        return [
            'period' => [
                'from' => $this->from,
                'to' => $this->to,
            ],
            'totalRevenue' => $this->totalRevenue,
            'totalOrders' => $this->totalOrders,
            'totalProfit' => $this->totalProfit,
            'averageOrderValue' => $this->averageOrderValue,
            'dataPoints' => array_map(fn(DailyRevenuePointDTO $dp) => $dp->toArray(), $this->dataPoints),
            'paymentBreakdown' => $this->paymentBreakdown->toArray(),
        ];
    }
}
