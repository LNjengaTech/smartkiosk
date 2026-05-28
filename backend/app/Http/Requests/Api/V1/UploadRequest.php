<?php

// backend/app/Http/Requests/Api/V1/UploadRequest.php
// Purpose: Validates image upload requests — folder allowlist and size limits.

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class UploadRequest extends FormRequest
{
    /**
     * All authenticated users who pass the role check are authorized here.
     * Role enforcement happens in the controller via middleware.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Validation rules for image upload.
     *
     * base64: max 7MB = 7 * 1024 * 1024 bytes raw, but as base64 string
     *         it's ~33% larger, so we cap the string at ~9.5MB characters.
     *         We use a custom rule to check the decoded size precisely.
     */
    public function rules(): array
    {
        return [
            'base64' => [
                'required',
                'string',
                // 7MB raw ≈ 9,961,472 base64 chars (ceil(7*1024*1024/3)*4)
                'max:9961472',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    // Strip data URI prefix if present before decoding
                    $raw = preg_replace('/^data:[^;]+;base64,/', '', (string) $value);
                    $decoded = base64_decode((string) $raw, true);

                    if ($decoded === false) {
                        $fail('The :attribute must be a valid base64-encoded image.');

                        return;
                    }

                    $bytes = strlen($decoded);
                    $maxBytes = 7 * 1024 * 1024; // 7MB

                    if ($bytes > $maxBytes) {
                        $fail('The :attribute must not exceed 7MB.');
                    }
                },
            ],
            'folder' => [
                'required',
                'string',
                'in:smartkiosk/products,smartkiosk/categories',
            ],
        ];
    }

    /**
     * Human-friendly attribute names in error messages.
     */
    public function attributes(): array
    {
        return [
            'base64' => 'image data',
            'folder' => 'upload folder',
        ];
    }
}
