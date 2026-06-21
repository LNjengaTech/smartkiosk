<?php

// backend/app/DTOs/Reports/RecentTransactionDTO.php
// Purpose: DTO representing a recent transaction for the dashboard view.

namespace App\DTOs\Reports;

readonly class RecentTransactionDTO
{
    public function __construct(
        public string $saleId, // UUID
        public string $receiptNumber,
        public string $cashierName,
        public float $totalAmount,
        public string $paymentMethod,
        public string $status, // completed, voided, refunded
        public string $soldAt // ISO-8601 string
    ) {}

    public function toArray(): array
    {
        return [
            'saleId' => $this->saleId,
            'receiptNumber' => $this->receiptNumber,
            'cashierName' => $this->cashierName,
            'totalAmount' => $this->totalAmount,
            'paymentMethod' => $this->paymentMethod,
            'status' => $this->status,
            'soldAt' => $this->soldAt,
        ];
    }
}
