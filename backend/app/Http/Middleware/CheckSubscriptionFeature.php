<?php

// backend/app/Http/Middleware/CheckSubscriptionFeature.php
// Purpose: Enforces feature limits based on the shop's active subscription tier.

namespace App\Http\Middleware;

use App\Models\PlatformConfig;
use App\Models\SubscriptionTier;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSubscriptionFeature
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // Super admins bypass all feature gating
        if ($user->hasRole('super_admin')) {
            return $next($request);
        }

        $shop = $user->shop;
        if (! $shop) {
            return response()->json([
                'success' => false,
                'message' => 'User does not belong to any shop.',
            ], 400);
        }

        // 1. Check Super Admin Master Switch
        // When false, all shops get full access
        $config = PlatformConfig::instance();
        if (! $config->is_master_switch_on) {
            return $next($request);
        }

        // 2. Load active subscription
        $subscription = $shop->subscription;
        if (! $subscription || ! $subscription->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Your shop subscription is inactive or expired. Please subscribe.',
            ], 403);
        }

        // Check if trial/subscription has expired
        if ($subscription->isExpired()) {
            return response()->json([
                'success' => false,
                'message' => 'Your subscription has expired. Please upgrade or renew.',
            ], 403);
        }

        // 3. Look up active tier feature maps
        $tierName = $subscription->plan;
        $tier = SubscriptionTier::where('name', $tierName)->where('is_active', true)->first();
        if (! $tier) {
            return response()->json([
                'success' => false,
                'message' => "Invalid subscription plan: {$tierName}",
            ], 403);
        }

        $features = $tier->features; // Supposed to be cast as array in model
        if (! isset($features[$feature]) || ! $features[$feature]) {
            return response()->json([
                'success' => false,
                'message' => "This feature '{$feature}' is not available in your current '{$tierName}' plan. Please upgrade.",
            ], 403);
        }

        return $next($request);
    }
}
