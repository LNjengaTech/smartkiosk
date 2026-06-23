<?php

// backend/app/Http/Controllers/Api/V1/NotificationController.php
// Purpose: In-app notification endpoints — list, mark read, mark all read, delete, and sync-failed reporting.

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\NotificationService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class NotificationController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    /**
     * Display a listing of the authenticated user's notifications.
     */
    public function index(Request $request): JsonResponse
    {
        $query = $request->user()->notifications();

        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $perPage = $request->integer('per_page', 20);
        $paginator = $query->paginate($perPage);

        $unreadCount = $request->user()->unreadNotifications()->count();

        $mapped = collect($paginator->items())->map(function ($notif) {
            $type = $notif->data['type'] ?? 'low_stock';
            $title = $notif->data['title'] ?? '';
            $message = $notif->data['message'] ?? '';
            $data = $notif->data['data'] ?? [];

            return [
                'id' => $notif->id,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'data' => $data,
                'readAt' => $notif->read_at?->toIso8601String(),
                'createdAt' => $notif->created_at?->toIso8601String(),
            ];
        });

        return $this->success([
            'data' => $mapped,
            'unreadCount' => $unreadCount,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ]
        ], 'Notifications retrieved successfully.');
    }

    /**
     * Mark a specific notification as read.
     */
    public function markAsRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return $this->noContent();
    }

    /**
     * Mark all unread notifications of the user as read.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications->markAsRead();

        return $this->noContent();
    }

    /**
     * Delete a specific notification.
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->delete();

        return $this->noContent();
    }

    /**
     * Report sync failure from the frontend.
     */
    public function reportSyncFailed(Request $request): JsonResponse
    {
        $request->validate([
            'pendingCount' => 'required|integer|min:1',
            'oldestPendingAt' => 'required|date',
        ]);

        $shop = $request->user()->shop;
        if (! $shop) {
            return $this->error('User has no associated shop.', 400);
        }

        /** @var string $oldestPendingAtStr */
        $oldestPendingAtStr = $request->input('oldestPendingAt');
        $oldestPendingAt = Carbon::parse($oldestPendingAtStr);

        // Check if oldest pending item is older than 1 hour
        if ($oldestPendingAt->lessThan(Carbon::now()->subHour())) {
            $this->notificationService->notifySyncFailed(
                $shop,
                $request->integer('pendingCount'),
                $oldestPendingAt->toIso8601String()
            );
        }

        return $this->success(null, 'Sync failure reported successfully.');
    }
}
