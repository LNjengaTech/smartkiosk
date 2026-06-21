<?php

// backend/app/Http/Resources/Api/V1/ExpenseResource.php
// Purpose: Shapes Expense into a consistent camelCase JSON response.

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExpenseResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'uuid' => $this->uuid,
            'shopId' => (string) $this->shop_id,
            'userId' => (string) $this->user_id,
            'userName' => $this->user ? $this->user->name : 'Unknown Cashier',
            'category' => $this->category,
            'amount' => (float) $this->amount,
            'description' => $this->description,
            'expenseDate' => $this->expense_date instanceof \DateTimeInterface 
                ? $this->expense_date->format('Y-m-d') 
                : (string) $this->expense_date,
            'receiptUrl' => $this->receipt_url,
            'syncedAt' => $this->synced_at ? $this->synced_at->toIso8601String() : null,
            'createdAt' => $this->created_at->toIso8601String(),
            'updatedAt' => $this->updated_at->toIso8601String(),
        ];
    }
}
