<?php

// backend/app/DTOs/Reports/StockReportDTO.php
// Purpose: DTO representing aggregated stock report details.

namespace App\DTOs\Reports;

readonly class StockReportDTO
{
    /**
     * @param StockReportItemDTO[] $items
     */
    public function __construct(
        public float $totalValue,
        public int $totalProducts,
        public int $lowStockCount,
        public int $outOfStockCount,
        public int $expiringSoonCount,
        public array $items
    ) {}

    public function toArray(): array
    {
        return [
            'totalValue' => $this->totalValue,
            'totalProducts' => $this->totalProducts,
            'lowStockCount' => $this->lowStockCount,
            'outOfStockCount' => $this->outOfStockCount,
            'expiringSoonCount' => $this->expiringSoonCount,
            'items' => array_map(fn(StockReportItemDTO $item) => $item->toArray(), $this->items),
        ];
    }
}
