<?php

// backend/bootstrap/app.php
// Purpose: Configures Laravel application routing, middleware aliases, and modern global exceptions.

use App\Http\Middleware\CheckSubscriptionFeature;
use App\Http\Middleware\EnsureShopAccess;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;
use Spatie\Permission\Middleware\RoleOrPermissionMiddleware;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Stateful domains for Sanctum single-page application auth
        $middleware->statefulApi();

        // Register custom middleware aliases
        $middleware->alias([
            'shop.access' => EnsureShopAccess::class,
            'subscription.feature' => CheckSubscriptionFeature::class,
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
            'role_or_permission' => RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Modern exception rendering inside API boundary checks

        // 1. Validation Exception Mapping (422)
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'The given data was invalid.',
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        // 2. Authentication Exception Mapping (401)
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.',
                ], 401);
            }
        });

        // 3. Authorization Exception Mapping (403)
        $exceptions->render(function (AccessDeniedHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Insufficient permissions.',
                ], 403);
            }
        });

        // 4. Model/Route Not Found Mapping (404)
        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Resource not found.',
                ], 404);
            }
        });

        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Resource not found.',
                ], 404);
            }
        });

        // 5. Rate Limiting Exception Mapping (429)
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*')) {
                $seconds = $e->getHeaders()['Retry-After'] ?? 60;

                return response()->json([
                    'success' => false,
                    'message' => "Too many attempts. Please slow down. Retry after {$seconds} seconds.",
                ], 429)->withHeaders($e->getHeaders());
            }
        });

        // 6. Generic Server Error mapping (500)
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*')) {
                $errorId = Str::uuid()->toString();

                Log::error("API_SERVER_ERROR [{$errorId}]: ".$e->getMessage(), [
                    'error_id' => $errorId,
                    'exception' => get_class($e),
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString(),
                ]);

                // Expose details only if app debug is enabled
                if (config('app.debug')) {
                    return response()->json([
                        'success' => false,
                        'message' => $e->getMessage(),
                        'error_id' => $errorId,
                        'exception' => get_class($e),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                    ], 500);
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Something went wrong. Please try again.',
                    'error_id' => $errorId,
                ], 500);
            }
        });
    })->create();
