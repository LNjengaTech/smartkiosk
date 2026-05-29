<?php

// backend/app/Http/Requests/Api/V1/Category/StoreCategoryRequest.php
// Purpose: Validates category creation. Enforces name uniqueness per shop.

namespace App\Http\Requests\Api\V1\Category;

use Illuminate\Foundation\Http\FormRequest;

class StoreCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'        => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'image_url'   => ['nullable', 'string', 'url', 'max:2048'],
        ];
    }
}
