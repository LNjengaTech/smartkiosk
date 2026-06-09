<?php

// backend/app/Http/Resources/Api/V1/SaleResource.php
// Purpose: Shapes the Sale model and nested line items into camelCase JSON.

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class SaleResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'shopId' => $this->shop_id,
            'userId' => $this->user_id,
            'receiptNumber' => $this->receipt_number,
            'subtotal' => (float) $this->subtotal,
            'discountAmount' => (float) $this->discount_amount,
            'taxAmount' => (float) $this->tax_amount,
            'totalAmount' => (float) $this->total_amount,
            'amountPaid' => (float) $this->amount_paid,
            'changeAmount' => (float) $this->change_amount,
            'paymentMethod' => $this->payment_method,
            'mpesaReference' => $this->mpesa_reference,
            'status' => $this->status,
            'notes' => $this->notes,
            'soldAt' => $this->sold_at instanceof \DateTimeInterface 
                ? $this->sold_at->toIso8601String() 
                : ($this->sold_at ? Carbon::parse($this->sold_at)->toIso8601String() : null),
            'syncedAt' => $this->synced_at instanceof \DateTimeInterface 
                ? $this->synced_at->toIso8601String() 
                : ($this->synced_at ? Carbon::parse($this->synced_at)->toIso8601String() : null),
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            
            // Nested items (always loaded / when loaded)
            'items' => $this->relationLoaded('items') 
                ? $this->items->map(fn($item) => [
                    'id' => $item->id,
                    'uuid' => $item->uuid,
                    'productId' => $item->product_id,
                    'productName' => $item->product_name,
                    'quantity' => (float) $item->quantity,
                    'unitPrice' => (float) $item->unit_price,
                    'buyingPrice' => (float) $item->buying_price,
                    'discount' => (float) $item->discount,
                    'total' => (float) $item->total,
                ])
                : [],
        ];
    }
}
