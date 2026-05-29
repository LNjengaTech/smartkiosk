<?php

// backend/app/Http/Requests/Api/V1/Category/UpdateCategoryRequest.php
// Purpose: Validates category updates — all fields optional (PATCH-style).

namespace App\Http\Requests\Api\V1\Category;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'        => ['sometimes', 'required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'image_url'   => ['nullable', 'string', 'url', 'max:2048'],
        ];
    }
}
