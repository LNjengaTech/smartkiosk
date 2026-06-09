<?php

// backend/app/Http/Requests/Api/V1/Sale/StoreSaleRequest.php
// Purpose: Validates POS sale submissions (individual items, total paid, references).

namespace App\Http\Requests\Api\V1\Sale;

use Illuminate\Foundation\Http\FormRequest;

class StoreSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid' => ['nullable', 'string', 'uuid'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_uuid' => ['required', 'string'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.001'],
            'payment_method' => ['required', 'string', 'in:cash,mpesa,bank,mixed'],
            'payment_split' => ['nullable', 'array'],
            'payment_split.cash' => ['nullable', 'numeric', 'min:0'],
            'payment_split.mpesa' => ['nullable', 'numeric', 'min:0'],
            'payment_split.bank' => ['nullable', 'numeric', 'min:0'],
            'amount_paid' => ['nullable', 'numeric', 'min:0'],
            'mpesa_reference' => ['nullable', 'string', 'max:50'],
            'bank_reference' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:500'],
            'sold_at' => ['nullable', 'date'],
        ];
    }
}
