<?php

// backend/app/Http/Middleware/EnsureShopAccess.php
// Purpose: Verifies the route-model-bound resource belongs to the
//          authenticated user's shop. Prevents cross-tenant data access.

namespace App\Http\Middleware;

use Closure;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureShopAccess
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // Super Admin has global platform-level access
        if ($user->hasRole('super_admin')) {
            return $next($request);
        }

        // Scan bound route models to enforce tenant boundary checks
        foreach ($request->route()->parameters() as $param) {
            if ($param instanceof Model && isset($param->shop_id)) {
                if ((int) $param->shop_id !== (int) $user->shop_id) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Insufficient permissions. Cross-tenant access denied.',
                    ], 403);
                }
            }
        }

        return $next($request);
    }
}
