<?php

// backend/app/Traits/ApiResponse.php
// Purpose: Provides consistent JSON response formatting for all API controllers.

namespace App\Traits;

use Illuminate\Http\JsonResponse;

trait ApiResponse
{
    /**
     * Return a generic success JSON response.
     */
    public function success(mixed $data, string $message = 'Success', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => $message,
        ], $status);
    }

    /**
     * Return a 201 Created success JSON response.
     */
    public function created(mixed $data, string $message = 'Created'): JsonResponse
    {
        return $this->success($data, $message, 201);
    }

    /**
     * Return a 204 No Content response.
     */
    public function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    /**
     * Return a standard error JSON response.
     */
    public function error(string $message, int $status = 400, ?array $errors = null): JsonResponse
    {
        $response = [
            'success' => false,
            'message' => $message,
        ];

        if ($errors !== null) {
            $response['errors'] = $errors;
        }

        return response()->json($response, $status);
    }

    /**
     * Return a 401 Unauthorized JSON response.
     */
    public function unauthorized(string $message = 'Unauthenticated'): JsonResponse
    {
        return $this->error($message, 401);
    }

    /**
     * Return a 403 Forbidden JSON response.
     */
    public function forbidden(string $message = 'Insufficient permissions'): JsonResponse
    {
        return $this->error($message, 403);
    }

    /**
     * Return a 404 Not Found JSON response.
     */
    public function notFound(string $message = 'Resource not found'): JsonResponse
    {
        return $this->error($message, 404);
    }

    /**
     * Return a 500 Server Error JSON response with logged UUID reference.
     */
    public function serverError(string $errorId, int $status = 500): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Something went wrong. Please try again.',
            'error_id' => $errorId,
        ], $status);
    }
}
