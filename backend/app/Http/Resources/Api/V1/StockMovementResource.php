<?php

// backend/app/Http/Resources/Api/V1/StockMovementResource.php
// Purpose: Shapes StockMovement model into consistent camelCase API response.

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StockMovementResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'             => $this->id,
            'uuid'           => $this->uuid,
            'shopId'         => $this->shop_id,
            'productId'      => $this->product_id,
            'userId'         => $this->user_id,
            'movementType'   => $this->movement_type,
            'delta'          => (float) $this->delta,
            'quantityBefore' => (float) $this->quantity_before,
            'quantityAfter'  => (float) $this->quantity_after,
            'unitCost'       => $this->unit_cost !== null ? (float) $this->unit_cost : null,
            'notes'          => $this->notes,
            'occurredAt'     => $this->occurred_at?->toIso8601String(),
            'createdAt'      => $this->created_at?->toIso8601String(),

            // Nested relations (eager loaded)
            'product'        => $this->whenLoaded('product', function () {
                return $this->product ? [
                    'id'      => $this->product->id,
                    'name'    => $this->product->name,
                    'barcode' => $this->product->barcode,
                ] : null;
            }),
            'user'           => $this->whenLoaded('user', function () {
                return $this->user ? [
                    'id'   => $this->user->id,
                    'name' => $this->user->name,
                ] : null;
            }),
        ];
    }
}
