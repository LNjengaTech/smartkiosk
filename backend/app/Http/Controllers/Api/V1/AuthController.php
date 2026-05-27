<?php

// backend/app/Http/Controllers/Api/V1/AuthController.php
// Purpose: Handles secure tenant authentication, Sanctum token issuance, profile queries, and logout.

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    use ApiResponse;

    /**
     * Authenticate user credentials and return an access token.
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::with('shop')->where('email', $request->email)->first();

        // 1. Verify user existence and password hash
        if (! $user || ! Hash::check($request->password, $user->password)) {
            return $this->error('Invalid email or password credentials.', 401);
        }

        // 2. Verify account activation status
        if (! $user->is_active) {
            return $this->error('Your account is currently deactivated. Please contact support.', 403);
        }

        // 3. Verify associated shop status (if user belongs to a shop)
        if ($user->shop && ! $user->shop->is_active) {
            return $this->error('Your shop account is currently suspended. Please contact billing.', 403);
        }

        // 4. Update last login auditing timestamp
        $user->update([
            'last_login_at' => Carbon::now(),
        ]);

        // 5. Generate Sanctum authentication token
        $tokenName = 'smartkiosk-session-'.$user->uuid;
        // Super admins get wide abilities, standard users get basic abilities
        $abilities = $user->hasRole('super_admin') ? ['*'] : ['tenant-access'];
        $token = $user->createToken($tokenName, $abilities)->plainTextToken;

        // 6. Structure standard user payload profile
        $userPayload = [
            'uuid' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];

        // Include shop tenant scoping context if available
        $shopPayload = null;
        if ($user->shop) {
            $shopPayload = [
                'uuid' => $user->shop->uuid,
                'business_name' => $user->shop->business_name,
                'location' => $user->shop->location,
                'currency' => $user->shop->currency,
                'timezone' => $user->shop->timezone,
            ];
        }

        return $this->success([
            'user' => $userPayload,
            'shop' => $shopPayload,
            'token' => $token,
            'token_type' => 'Bearer',
        ], 'Authentication successful.');
    }

    /**
     * Revoke the current user's active session token.
     */
    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user) {
            // Delete current active personal access token
            $user->currentAccessToken()->delete();
        }

        return $this->success(null, 'Logged out successfully.', 200);
    }

    /**
     * Retrieve the authenticated user's profile, roles, and tenant parameters.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return $this->unauthorized();
        }

        // Reload user with shop context
        $user->load('shop');

        $userPayload = [
            'uuid' => $user->uuid,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];

        $shopPayload = null;
        if ($user->shop) {
            $shopPayload = [
                'uuid' => $user->shop->uuid,
                'business_name' => $user->shop->business_name,
                'location' => $user->shop->location,
                'currency' => $user->shop->currency,
                'timezone' => $user->shop->timezone,
            ];
        }

        return $this->success([
            'user' => $userPayload,
            'shop' => $shopPayload,
        ], 'Profile retrieved successfully.');
    }
}
