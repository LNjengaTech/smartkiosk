<?php

// backend/app/DTOs/Reports/TopProductDTO.php
// Purpose: DTO representing a top selling product's summary metrics.

namespace App\DTOs\Reports;

readonly class TopProductDTO
{
    public function __construct(
        public string $productId, // UUID
        public string $name,
        public ?string $imageUrl,
        public float $revenue,
        public float $unitsSold
    ) {}

    public function toArray(): array
    {
        return [
            'productId' => $this->productId,
            'name' => $this->name,
            'imageUrl' => $this->imageUrl,
            'revenue' => $this->revenue,
            'unitsSold' => $this->unitsSold,
        ];
    }
}
