<?php

// backend/app/Http/Resources/Api/V1/ProductResource.php
// Purpose: Shapes the Product model into a consistent camelCase JSON response.

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'uuid'         => $this->uuid,
            'shopId'       => $this->shop_id,
            'categoryId'   => $this->category_id,
            'supplierId'   => $this->supplier_id,
            'name'         => $this->name,
            'sku'          => $this->sku,
            'barcode'      => $this->barcode,
            'buyingPrice'  => (float) $this->buying_price,
            'sellingPrice' => (float) $this->selling_price,
            'quantity'     => (float) $this->quantity,
            'reorderLevel' => (float) $this->reorder_level,
            'unit'         => $this->unit,
            'expiryDate'   => $this->expiry_date instanceof \DateTimeInterface 
                ? $this->expiry_date->format('Y-m-d') 
                : ($this->expiry_date ? substr($this->expiry_date, 0, 10) : null),
            'imageUrl'     => $this->image_url,
            'isActive'     => (bool) $this->is_active,
            'syncedAt'     => $this->synced_at?->toIso8601String(),
            'createdAt'    => $this->created_at?->toIso8601String(),
            'updatedAt'    => $this->updated_at?->toIso8601String(),
            
            // Nested relationships (eager loaded)
            'category'     => $this->whenLoaded('category', function () {
                return $this->category ? [
                    'id'   => $this->category->id,
                    'name' => $this->category->name,
                ] : null;
            }),
            'supplier'     => $this->whenLoaded('supplier', function () {
                return $this->supplier ? [
                    'id'   => $this->supplier->id,
                    'name' => $this->supplier->name,
                ] : null;
            }),
        ];
    }
}
