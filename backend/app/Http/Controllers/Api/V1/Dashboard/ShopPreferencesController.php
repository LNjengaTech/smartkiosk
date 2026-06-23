<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/ShopPreferencesController.php
// Purpose: Allows business owners to update shop-wide preferences like notification settings.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopPreferencesController extends Controller
{
    use ApiResponse;

    /**
     * Update the notification preferences for the authenticated user's shop.
     */
    public function updateNotificationPreferences(Request $request): JsonResponse
    {
        $shop = $request->user()->shop;

        if (! $shop) {
            return $this->error('User is not assigned to a shop.', 400);
        }

        $validated = $request->validate([
            'low_stock' => 'required|array',
            'low_stock.in_app' => 'required|boolean',
            'low_stock.email' => 'required|boolean',
            'low_stock.sms' => 'required|boolean',

            'expiry_alert' => 'required|array',
            'expiry_alert.in_app' => 'required|boolean',
            'expiry_alert.email' => 'required|boolean',
            'expiry_alert.sms' => 'required|boolean',

            'daily_summary' => 'required|array',
            'daily_summary.in_app' => 'required|boolean',
            'daily_summary.email' => 'required|boolean',
            'daily_summary.sms' => 'required|boolean',

            'sale_voided' => 'required|array',
            'sale_voided.in_app' => 'required|boolean',
            'sale_voided.email' => 'required|boolean',
            'sale_voided.sms' => 'required|boolean',

            'sync_failed' => 'required|array',
            'sync_failed.in_app' => 'required|boolean',
            'sync_failed.email' => 'required|boolean',
            'sync_failed.sms' => 'required|boolean',
        ]);

        // Force in_app to true for all notification types as per requirement
        $validated['low_stock']['in_app'] = true;
        $validated['expiry_alert']['in_app'] = true;
        $validated['daily_summary']['in_app'] = true;
        $validated['sale_voided']['in_app'] = true;
        $validated['sync_failed']['in_app'] = true;

        $shop->update([
            'notification_preferences' => $validated,
        ]);

        return $this->success($shop->notification_preferences, 'Notification preferences updated successfully.');
    }

    /**
     * Retrieve the notification preferences for the authenticated user's shop.
     */
    public function getNotificationPreferences(Request $request): JsonResponse
    {
        $shop = $request->user()->shop;

        if (! $shop) {
            return $this->error('User is not assigned to a shop.', 400);
        }

        // Return current preferences, fallback to default presets if null
        $prefs = $shop->notification_preferences ?? [
            'low_stock' => ['in_app' => true, 'email' => false, 'sms' => false],
            'expiry_alert' => ['in_app' => true, 'email' => false, 'sms' => false],
            'daily_summary' => ['in_app' => true, 'email' => false, 'sms' => false],
            'sale_voided' => ['in_app' => true, 'email' => false, 'sms' => false],
            'sync_failed' => ['in_app' => true, 'email' => false, 'sms' => false],
        ];

        return $this->success($prefs, 'Notification preferences retrieved successfully.');
    }
}
