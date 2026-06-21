<?php

// backend/app/DTOs/Reports/ExpenseCategoryDTO.php
// Purpose: DTO representing aggregated expense metrics for a single category.

namespace App\DTOs\Reports;

readonly class ExpenseCategoryDTO
{
    public function __construct(
        public string $category,
        public float $total,
        public int $count,
        public float $percentage // e.g. 15.34
    ) {}

    public function toArray(): array
    {
        return [
            'category' => $this->category,
            'total' => $this->total,
            'count' => $this->count,
            'percentage' => $this->percentage,
        ];
    }
}
