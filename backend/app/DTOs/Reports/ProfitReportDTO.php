<?php

// backend/app/DTOs/Reports/ProfitReportDTO.php
// Purpose: DTO representing aggregated profit report details.

namespace App\DTOs\Reports;

readonly class ProfitReportDTO
{
    /**
     * @param ProfitProductDTO[] $topProfitProducts
     * @param DailyRevenuePointDTO[] $dailyProfit
     */
    public function __construct(
        public string $from,
        public string $to,
        public float $grossRevenue,
        public float $costOfGoodsSold,
        public float $grossProfit,
        public float $grossMargin,
        public array $topProfitProducts,
        public array $dailyProfit
    ) {}

    public function toArray(): array
    {
        return [
            'period' => [
                'from' => $this->from,
                'to' => $this->to,
            ],
            'grossRevenue' => $this->grossRevenue,
            'costOfGoodsSold' => $this->costOfGoodsSold,
            'grossProfit' => $this->grossProfit,
            'grossMargin' => $this->grossMargin,
            'topProfitProducts' => array_map(fn(ProfitProductDTO $p) => $p->toArray(), $this->topProfitProducts),
            'dailyProfit' => array_map(fn(DailyRevenuePointDTO $dp) => $dp->toArray(), $this->dailyProfit),
        ];
    }
}
