<?php

// backend/app/DTOs/Reports/StockReportItemDTO.php
// Purpose: DTO representing a product's stock valuation metrics.

namespace App\DTOs\Reports;

readonly class StockReportItemDTO
{
    public function __construct(
        public string $productId, // UUID
        public string $name,
        public ?string $sku,
        public ?string $categoryName,
        public float $quantity,
        public float $reorderLevel,
        public string $unit,
        public string $status, // 'in_stock' | 'low_stock' | 'out_of_stock'
        public float $buyingPrice,
        public float $sellingPrice,
        public float $stockValue // buying_price * quantity
    ) {}

    public function toArray(): array
    {
        return [
            'productId' => $this->productId,
            'name' => $this->name,
            'sku' => $this->sku,
            'categoryName' => $this->categoryName,
            'quantity' => $this->quantity,
            'reorderLevel' => $this->reorderLevel,
            'unit' => $this->unit,
            'status' => $this->status,
            'buyingPrice' => $this->buyingPrice,
            'sellingPrice' => $this->sellingPrice,
            'stockValue' => $this->stockValue,
        ];
    }
}
