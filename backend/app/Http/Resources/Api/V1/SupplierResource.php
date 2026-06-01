<?php

// backend/app/Http/Resources/Api/V1/SupplierResource.php
// Purpose: Shapes Supplier into a consistent camelCase JSON response.

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierResource extends JsonResource
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
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'notes' => $this->notes,
            'productCount' => $this->whenCounted('products', function ($count) {
                return (int) $count;
            }, 0),
            'stockMovementCount' => $this->whenCounted('stockMovements', function ($count) {
                return (int) $count;
            }, 0),
            'createdAt' => $this->created_at->toIso8601String(),
            'updatedAt' => $this->updated_at->toIso8601String(),
        ];
    }
}
