<?php

// backend/app/Http/Requests/Api/V1/Expense/StoreExpenseRequest.php
// Purpose: Validates expense creation. Supports offline-first uuid preservation.

namespace App\Http\Requests\Api\V1\Expense;

use Illuminate\Foundation\Http\FormRequest;

class StoreExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'uuid'         => ['nullable', 'uuid'],
            'category'     => ['required', 'string', 'in:rent,salary,electricity,internet,transport,maintenance,other'],
            'amount'       => ['required', 'numeric', 'min:0.01'],
            'description'  => ['nullable', 'string', 'max:1000'],
            'expense_date' => ['required', 'date', 'before_or_equal:today'],
            'receipt_url'  => ['nullable', 'string', 'max:2048'],
        ];
    }
}
