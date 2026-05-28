<?php

// backend/app/Http/Controllers/Api/V1/UploadController.php
// Purpose: Handles image upload to Cloudinary. OWNER and MANAGER roles only.

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UploadRequest;
use App\Services\CloudinaryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class UploadController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly CloudinaryService $cloudinaryService,
    ) {}

    /**
     * Upload an image to Cloudinary and return the CDN URL and publicId.
     * Only OWNER and MANAGER roles are permitted.
     *
     * POST /api/v1/upload
     */
    public function store(UploadRequest $request): JsonResponse
    {
        // Role check — owner or manager only
        $user = $request->user();
        if (! $user->hasAnyRole(['owner', 'manager', 'super_admin'])) {
            return $this->forbidden('Only owners and managers can upload images.');
        }

        try {
            $result = $this->cloudinaryService->uploadImage(
                base64: $request->validated('base64'),
                folder: $request->validated('folder'),
            );

            return $this->success([
                'url'       => $result->url,
                'publicId'  => $result->publicId,
            ], 'Image uploaded successfully.', 201);

        } catch (RuntimeException $e) {
            $errorId = Str::uuid()->toString();

            Log::error("[UPLOAD_ERROR] [{$errorId}]: ".$e->getMessage(), [
                'error_id'  => $errorId,
                'folder'    => $request->validated('folder'),
                'user_id'   => $user->id,
                'exception' => get_class($e),
                'file'      => $e->getFile(),
                'line'      => $e->getLine(),
            ]);

            // Never expose raw Cloudinary exception message in production
            return $this->serverError($errorId);
        }
    }
}
