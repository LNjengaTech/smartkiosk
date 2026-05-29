<?php

// backend/app/Http/Resources/Api/V1/CategoryResource.php
// Purpose: API Resource — shapes the Category model into a consistent JSON response.

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
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
            'name'         => $this->name,
            'description'  => $this->description,
            'imageUrl'     => $this->image_url,
            'productCount' => $this->whenLoaded('products', fn () => $this->products->count(), $this->products_count ?? 0),
            'createdAt'    => $this->created_at?->toIso8601String(),
            'updatedAt'    => $this->updated_at?->toIso8601String(),
        ];
    }
}
