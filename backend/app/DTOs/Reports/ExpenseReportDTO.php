<?php

// backend/app/DTOs/Reports/ExpenseReportDTO.php
// Purpose: DTO representing aggregated expense report details.

namespace App\DTOs\Reports;

readonly class ExpenseReportDTO
{
    /**
     * @param ExpenseCategoryDTO[] $byCategory
     */
    public function __construct(
        public string $from,
        public string $to,
        public float $totalExpenses,
        public array $byCategory
    ) {}

    public function toArray(): array
    {
        return [
            'period' => [
                'from' => $this->from,
                'to' => $this->to,
            ],
            'totalExpenses' => $this->totalExpenses,
            'byCategory' => array_map(fn(ExpenseCategoryDTO $c) => $c->toArray(), $this->byCategory),
        ];
    }
}
