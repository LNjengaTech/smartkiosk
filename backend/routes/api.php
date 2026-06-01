<?php

// backend/routes/api.php
// Purpose: Main API route configuration. Defines public/private V1 endpoints and middleware boundaries.

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\Dashboard\CategoryController;
use App\Http\Controllers\Api\V1\Dashboard\ProductController;
use App\Http\Controllers\Api\V1\Dashboard\StockController;
use App\Http\Controllers\Api\V1\Dashboard\SupplierController;
use App\Http\Controllers\Api\V1\UploadController;
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
            // Supplier Management (Owner Only)
            // ==========================================
            Route::middleware('role:owner')->group(function () {
                Route::apiResource('suppliers', SupplierController::class);
            });
        });
    });
});
