<?php

// backend/app/DTOs/Reports/ProfitProductDTO.php
// Purpose: DTO representing aggregated profit metrics for a single product.

namespace App\DTOs\Reports;

readonly class ProfitProductDTO
{
    public function __construct(
        public string $productId, // UUID
        public string $name,
        public float $revenue,
        public float $cogs,
        public float $profit,
        public float $margin // percentage, e.g. 28.5
    ) {}

    public function toArray(): array
    {
        return [
            'productId' => $this->productId,
            'name' => $this->name,
            'revenue' => $this->revenue,
            'cogs' => $this->cogs,
            'profit' => $this->profit,
            'margin' => $this->margin,
        ];
    }
}
