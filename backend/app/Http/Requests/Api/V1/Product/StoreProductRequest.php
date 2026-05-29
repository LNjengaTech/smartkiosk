<?php

// backend/app/Http/Requests/Api/V1/Product/StoreProductRequest.php
// Purpose: Validates product creation. Ensures category and supplier belong to the shop (OWASP A01).

namespace App\Http\Requests\Api\V1\Product;

use App\Models\Category;
use App\Models\Supplier;
use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'          => ['required', 'string', 'max:150'],
            'sku'           => ['nullable', 'string', 'max:50'],
            'barcode'       => ['nullable', 'string', 'max:50'],
            'category_id'   => ['nullable', 'integer'],
            'supplier_id'   => ['nullable', 'integer'],
            'buying_price'  => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0', 'gte:buying_price'],
            'quantity'      => ['required', 'numeric', 'min:0'],
            'reorder_level' => ['required', 'numeric', 'min:0'],
            'unit'          => ['required', 'string', 'in:piece,kg,litre,pack'],
            'expiry_date'   => ['nullable', 'date'],
            'image_url'     => ['nullable', 'string', 'url', 'max:2048'],
            'is_active'     => ['sometimes', 'boolean'],
        ];
    }

    /**
     * OWASP A01 custom after-validation rule to verify FK tenant boundaries.
     */
    public function after(): array
    {
        return [
            function ($validator) {
                $user = $this->user();
                if (! $user) {
                    return;
                }

                $shopId = $user->shop_id;

                // Category verification
                if ($this->filled('category_id')) {
                    $catId = $this->input('category_id');
                    $exists = Category::where('id', $catId)
                        ->where('shop_id', $shopId)
                        ->exists();

                    if (! $exists) {
                        $validator->errors()->add('category_id', 'The selected category is invalid or does not belong to this shop.');
                    }
                }

                // Supplier verification
                if ($this->filled('supplier_id')) {
                    $supId = $this->input('supplier_id');
                    $exists = Supplier::where('id', $supId)
                        ->where('shop_id', $shopId)
                        ->exists();

                    if (! $exists) {
                        $validator->errors()->add('supplier_id', 'The selected supplier is invalid or does not belong to this shop.');
                    }
                }
            }
        ];
    }
}
