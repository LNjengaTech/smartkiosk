<?php

// backend/app/Exceptions/InsufficientStockException.php
// Purpose: Typed domain exception raised by StockService when a stock-out
//          would make quantity drop below zero. Never swallowed silently.

namespace App\Exceptions;

use RuntimeException;

class InsufficientStockException extends RuntimeException
{
    public function __construct(
        public readonly string $productName,
        public readonly float  $requested,
        public readonly float  $available,
    ) {
        parent::__construct(
            "Insufficient stock for '{$productName}': requested {$requested}, available {$available}."
        );
    }
}
