<?php

// backend/routes/api.php
// Purpose: Main API route configuration. Defines public/private V1 endpoints and middleware boundaries.

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\Dashboard\CategoryController;
use App\Http\Controllers\Api\V1\Dashboard\ProductController;
use App\Http\Controllers\Api\V1\Dashboard\StockController;
use App\Http\Controllers\Api\V1\Dashboard\SupplierController;
use App\Http\Controllers\Api\V1\Dashboard\SaleController;
use App\Http\Controllers\Api\V1\Dashboard\MpesaController;
use App\Http\Controllers\Api\V1\Dashboard\ReportController;
use App\Http\Controllers\Api\V1\Dashboard\ExpenseController;
use App\Http\Controllers\Api\V1\Sync\SyncController;
use App\Http\Controllers\Api\V1\UploadController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\Dashboard\ShopPreferencesController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group.
|
*/

Route::prefix('v1')->group(function () {

    // ==========================================
    // Public Authentication Endpoints
    // ==========================================
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/payments/mpesa/callback', [MpesaController::class, 'callback'])->name('api.mpesa.callback');

    // ==========================================
    // Protected Session & Tenant Endpoints
    // ==========================================
    Route::middleware('auth:sanctum')->group(function () {

        // Session management
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        // ==========================================
        // Image Upload (owner + manager only)
        // ==========================================
        Route::post('/upload', [UploadController::class, 'store']);

        // ==========================================
        // Offline Sync Engine Batch Processing
        // ==========================================
        Route::post('/sync/batch', [SyncController::class, 'batch']);

        // ==========================================
        // Notifications Center
        // ==========================================
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
        Route::post('/notifications/sync-failed', [NotificationController::class, 'reportSyncFailed']);


        // ==========================================
        // Product SmartScan finder (<50ms target)
        // ==========================================
        Route::get('/products/barcode/{barcode}', [ProductController::class, 'findByBarcode']);

        // ------------------------------------------
        // Tenant boundary checking routes
        // ------------------------------------------
        Route::middleware('shop.access')->group(function () {
            // ==========================================
            // Category Management
            // ==========================================
            Route::get('/categories', [CategoryController::class, 'index']);
            Route::post('/categories', [CategoryController::class, 'store']);
            Route::put('/categories/{category}', [CategoryController::class, 'update']);
            Route::delete('/categories/{category}', [CategoryController::class, 'destroy']);

            // ==========================================
            // Product Catalog Management
            // ==========================================
            Route::get('/products', [ProductController::class, 'index']);
            Route::post('/products', [ProductController::class, 'store']);
            Route::get('/products/{product}', [ProductController::class, 'show']);
            Route::put('/products/{product}', [ProductController::class, 'update']);
            Route::delete('/products/{product}', [ProductController::class, 'destroy']);

            // ==========================================
            // Stock Management
            // ==========================================
            Route::get('/stock/movements', [StockController::class, 'movements']);
            Route::get('/stock/valuation', [StockController::class, 'valuation']);
            Route::post('/stock/adjust/{product}', [StockController::class, 'adjust']);

            // ==========================================
            // Sales Management
            // ==========================================
            Route::get('/sales', [SaleController::class, 'index']);
            Route::post('/sales', [SaleController::class, 'store']);
            Route::get('/sales/{sale}', [SaleController::class, 'show']);
            Route::post('/sales/{sale}/void', [SaleController::class, 'void']);

            // ==========================================
            // M-Pesa Integration (Private)
            // ==========================================
            Route::post('/payments/mpesa/stk-push', [MpesaController::class, 'stkPush']);
            Route::get('/payments/mpesa/status/{checkoutRequestId}', [MpesaController::class, 'status']);

            // ==========================================
            // Supplier Management (Owner Only)
            // ==========================================
            Route::middleware('role:owner')->group(function () {
                Route::apiResource('suppliers', SupplierController::class);
                Route::get('/shops/notification-preferences', [ShopPreferencesController::class, 'getNotificationPreferences']);
                Route::patch('/shops/notification-preferences', [ShopPreferencesController::class, 'updateNotificationPreferences']);
            });

            // ==========================================
            // Expense Management
            // ==========================================
            Route::apiResource('expenses', ExpenseController::class);

            // ==========================================
            // Reports & Business Intelligence
            // ==========================================
            Route::prefix('reports')->group(function () {
                Route::get('/dashboard', [ReportController::class, 'dashboard']);
                Route::get('/sales', [ReportController::class, 'sales']);
                Route::get('/stock', [ReportController::class, 'stock']);
                Route::get('/attendants', [ReportController::class, 'attendants']);
                Route::get('/expenses', [ReportController::class, 'expenses']);
                Route::get('/export', [ReportController::class, 'export']);

                // Owner-only profit report
                Route::middleware('role:owner|super_admin')->get('/profit', [ReportController::class, 'profit']);
            });
        });
    });
});
