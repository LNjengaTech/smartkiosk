<?php

// backend/app/Services/CloudinaryService.php
// Purpose: Wraps the Cloudinary SDK for image uploads and deletions.

namespace App\Services;

use App\DTOs\CloudinaryUploadResult;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class CloudinaryService
{
    /**
     * Allowed upload folders — prevents arbitrary bucket traversal.
     */
    private const ALLOWED_FOLDERS = [
        'smartkiosk/products',
        'smartkiosk/categories',
    ];

    /**
     * Upload a base64 image to Cloudinary.
     *
     * @param  string  $base64  Raw base64 encoded image data
     * @param  string  $folder  Target Cloudinary folder (must be in allowlist)
     * @return CloudinaryUploadResult Typed DTO with url and publicId
     *
     * @throws RuntimeException if folder is not allowed or upload fails
     */
    public function uploadImage(string $base64, string $folder): CloudinaryUploadResult
    {
        if (! in_array($folder, self::ALLOWED_FOLDERS, true)) {
            throw new RuntimeException("Upload folder '{$folder}' is not in the allowed list.");
        }

        try {
            $dataUri = $this->ensureDataUri($base64);

            $response = cloudinary()->upload($dataUri, [
                'folder'          => $folder,
                'resource_type'   => 'image',
                'allowed_formats' => ['jpg', 'jpeg', 'png', 'webp'],
            ]);

            $url      = $response->getSecurePath();
            $publicId = $response->getPublicId();

            if (empty($url) || empty($publicId)) {
                throw new RuntimeException('Cloudinary returned an empty URL or publicId.');
            }

            return new CloudinaryUploadResult(
                url: $url,
                publicId: $publicId,
            );
        } catch (RuntimeException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw new RuntimeException(
                'Cloudinary upload failed: '.$e->getMessage(),
                previous: $e,
            );
        }
    }

    /**
     * Delete an image from Cloudinary by its public ID.
     *
     * @throws RuntimeException if deletion fails
     */
    public function deleteImage(string $publicId): void
    {
        try {
            cloudinary()->destroy($publicId);
        } catch (\Throwable $e) {
            throw new RuntimeException(
                "Cloudinary deletion failed for publicId '{$publicId}': ".$e->getMessage(),
                previous: $e,
            );
        }
    }

    /**
     * Ensure the base64 string is formatted as a data URI.
     * Accepts either a raw base64 string or a complete data: URI.
     */
    private function ensureDataUri(string $base64): string
    {
        if (str_starts_with($base64, 'data:')) {
            return $base64;
        }

        // Detect image type from base64 magic bytes
        $decoded = base64_decode(substr($base64, 0, 16), true);
        $mime    = 'image/jpeg'; // safe default

        if ($decoded !== false) {
            if (str_starts_with($decoded, "\x89PNG")) {
                $mime = 'image/png';
            } elseif (str_starts_with($decoded, 'RIFF') || str_starts_with($decoded, 'WEBP')) {
                $mime = 'image/webp';
            }
        }

        return "data:{$mime};base64,{$base64}";
    }
}
