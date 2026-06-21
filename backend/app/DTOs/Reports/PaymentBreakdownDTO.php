<?php

// backend/app/DTOs/Reports/PaymentBreakdownDTO.php
// Purpose: DTO representing payment methods breakdowns (value + percent).

namespace App\DTOs\Reports;

readonly class PaymentBreakdownDTO
{
    public function __construct(
        public float $cash,
        public float $mpesa,
        public float $bank,
        public float $mixed,
        public float $cashPercentage,
        public float $mpesaPercentage,
        public float $bankPercentage,
        public float $mixedPercentage
    ) {}

    public function toArray(): array
    {
        return [
            'cash' => $this->cash,
            'mpesa' => $this->mpesa,
            'bank' => $this->bank,
            'mixed' => $this->mixed,
            'cashPercentage' => $this->cashPercentage,
            'mpesaPercentage' => $this->mpesaPercentage,
            'bankPercentage' => $this->bankPercentage,
            'mixedPercentage' => $this->mixedPercentage,
        ];
    }
}
