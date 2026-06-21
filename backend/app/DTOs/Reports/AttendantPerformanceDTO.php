<?php

// backend/app/DTOs/Reports/AttendantPerformanceDTO.php
// Purpose: DTO representing a cashier's performance metrics.

namespace App\DTOs\Reports;

readonly class AttendantPerformanceDTO
{
    public function __construct(
        public string $userId, // User UUID
        public string $name,
        public int $salesCount,
        public float $totalRevenue,
        public int $voidCount,
        public float $voidRate, // percentage
        public float $averageOrderValue
    ) {}

    public function toArray(): array
    {
        return [
            'userId' => $this->userId,
            'name' => $this->name,
            'salesCount' => $this->salesCount,
            'totalRevenue' => $this->totalRevenue,
            'voidCount' => $this->voidCount,
            'voidRate' => $this->voidRate,
            'averageOrderValue' => $this->averageOrderValue,
        ];
    }
}
