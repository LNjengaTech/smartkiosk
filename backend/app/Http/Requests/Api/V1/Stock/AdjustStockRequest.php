<?php

// backend/app/Http/Requests/Api/V1/Stock/AdjustStockRequest.php
// Purpose: Validates manual stock adjustment (stock-in / stock-out).

namespace App\Http\Requests\Api\V1\Stock;

use Illuminate\Foundation\Http\FormRequest;

class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'movement_type' => ['required', 'string', 'in:stock_in,stock_out,adjustment'],
            'quantity'      => ['required', 'numeric', 'min:0.01'],
            'unit_cost'     => ['nullable', 'numeric', 'min:0'],
            'notes'         => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Human-friendly names for validation messages.
     */
    public function attributes(): array
    {
        return [
            'movement_type' => 'movement type',
            'unit_cost'     => 'unit cost',
        ];
    }
}
