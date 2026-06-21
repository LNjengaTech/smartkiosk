<?php

// backend/app/DTOs/Reports/DailyRevenuePointDTO.php
// Purpose: DTO representing aggregated revenue metrics for a single date point.

namespace App\DTOs\Reports;

readonly class DailyRevenuePointDTO
{
    public function __construct(
        public string $date, // Y-m-d format
        public float $revenue,
        public int $orderCount,
        public float $profit
    ) {}

    public function toArray(): array
    {
        return [
            'date' => $this->date,
            'revenue' => $this->revenue,
            'orderCount' => $this->orderCount,
            'profit' => $this->profit,
        ];
    }
}
