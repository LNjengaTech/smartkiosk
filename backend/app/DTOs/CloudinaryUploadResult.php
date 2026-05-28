<?php

// backend/app/DTOs/CloudinaryUploadResult.php
// Purpose: Typed return value from Cloudinary upload operations.

namespace App\DTOs;

readonly class CloudinaryUploadResult
{
    public function __construct(
        public readonly string $url,
        public readonly string $publicId,
    ) {}
}
