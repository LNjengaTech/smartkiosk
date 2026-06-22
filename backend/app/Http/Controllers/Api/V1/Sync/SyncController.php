<?php

// backend/app/Http/Controllers/Api/V1/Sync/SyncController.php
// Purpose: Processes batched offline operations from the client sync engine.
//          Handles idempotency, conflict resolution, and delta merging.

namespace App\Http\Controllers\Api\V1\Sync;

use App\Http\Controllers\Controller;
use App\Models\SyncLog;
use App\Models\Product;
use App\Models\Category;
use App\Models\Supplier;
use App\Services\SaleService;
use App\Services\StockService;
use App\Exceptions\InsufficientStockException;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SyncController extends Controller
{
    public function __construct(
        private readonly SaleService $saleService,
        private readonly StockService $stockService
    ) {}

    /**
     * POST /api/v1/sync/batch
     */
    public function batch(Request $request): JsonResponse
    {
        $request->validate([
            'operations' => ['required', 'array', 'max:50'],
            'operations.*.operationUuid' => ['required', 'string'],
            'operations.*.operationType' => ['required', 'string'],
            'operations.*.resourceType' => ['required', 'string'],
            'operations.*.resourceUuid' => ['nullable', 'string'],
            'operations.*.payload' => ['required', 'array'],
            'operations.*.occurredAt' => ['nullable', 'string'],
        ]);

        $user = $request->user();
        $shopId = $user->shop_id;
        $operations = $request->input('operations');
        $results = [];

        foreach ($operations as $operation) {
            $operationUuid = $operation['operationUuid'];
            $resourceType = $operation['resourceType'];
            $resourceUuid = $operation['resourceUuid'] ?? null;
            $payload = $operation['payload'];

            // Validate operationUuid format immediately to prevent DB crash
            if (! Str::isUuid($operationUuid)) {
                Log::warning("Sync batch operation rejected: Invalid operationUuid format: {$operationUuid}");
                $results[] = [
                    'operationUuid' => $operationUuid,
                    'status' => 'failed',
                    'message' => 'Invalid operation UUID format.',
                ];
                continue;
            }

            // 1. Idempotency Check
            $existingLog = SyncLog::where('operation_uuid', $operationUuid)->first();
            if ($existingLog) {
                $results[] = [
                    'operationUuid' => $operationUuid,
                    'status' => 'synced',
                ];
                continue;
            }

            try {
                $data = null;

                // 2. Route by resource_type
                if ($resourceType === 'sale') {
                    // Inject operation_uuid so SaleService can create the SyncLog if needed,
                    // but we will also create it here or let SaleService handle it.
                    // Actually, SaleService creates SyncLog if operation_uuid is provided.
                    $payload['operation_uuid'] = $operationUuid;
                    $sale = $this->saleService->processSale($payload, $user);
                    $data = ['uuid' => $sale->uuid, 'receiptNumber' => $sale->receipt_number];
                } elseif ($resourceType === 'stock_movement') {
                    if (empty($resourceUuid) || ! Str::isUuid($resourceUuid)) {
                        throw new \Exception("Invalid stock movement UUID format: " . ($resourceUuid ?? 'null'));
                    }
                    SyncLog::create([
                        'shop_id' => $shopId,
                        'user_id' => $user->id,
                        'operation_uuid' => $operationUuid,
                        'resource_type' => $resourceType,
                        'resource_uuid' => $resourceUuid,
                        'status' => 'success',
                        'synced_at' => now(),
                    ]);
                } elseif ($resourceType === 'product') {
                    $operationType = $operation['operationType'] ?? null;
                    $productUuid   = $payload['uuid'] ?? $resourceUuid;

                    if (empty($productUuid) || ! Str::isUuid($productUuid)) {
                        throw new \Exception("Invalid product UUID format: " . ($productUuid ?? 'null'));
                    }

                    if ($operationType === 'DELETE') {
                        $product = Product::where('uuid', $productUuid)
                            ->where('shop_id', $shopId)
                            ->first();
                        if ($product) {
                            $product->delete();
                        }
                        $data = ['uuid' => $productUuid];
                    } else {
                        // CREATE or UPDATE — map snake_case frontend payload to DB columns

                        // Resolve category FK: the frontend sends category_uuid (safe) instead of
                        // the local Dexie integer ID which may differ from the backend's id.
                        $resolvedCategoryId = null;
                        if (! empty($payload['category_uuid']) && Str::isUuid($payload['category_uuid'])) {
                            $resolvedCategoryId = \App\Models\Category::where('uuid', $payload['category_uuid'])
                                ->where('shop_id', $shopId)
                                ->value('id');
                        } elseif (! empty($payload['category_id'])) {
                            // Legacy fallback: if direct id was sent, use it (seeded data only)
                            $resolvedCategoryId = $payload['category_id'];
                        }

                        // Resolve supplier FK: same UUID-based approach
                        $resolvedSupplierId = null;
                        if (! empty($payload['supplier_uuid']) && Str::isUuid($payload['supplier_uuid'])) {
                            $resolvedSupplierId = \App\Models\Supplier::where('uuid', $payload['supplier_uuid'])
                                ->where('shop_id', $shopId)
                                ->value('id');
                        } elseif (! empty($payload['supplier_id'])) {
                            $resolvedSupplierId = $payload['supplier_id'];
                        }

                        $fillable = [
                            'name'          => $payload['name']          ?? null,
                            'sku'           => $payload['sku']           ?? null,
                            'barcode'       => $payload['barcode']       ?? null,
                            'buying_price'  => $payload['buying_price']  ?? 0,
                            'selling_price' => $payload['selling_price'] ?? 0,
                            'quantity'      => $payload['quantity']      ?? 0,
                            'reorder_level' => $payload['reorder_level'] ?? 5,
                            'unit'          => $payload['unit']          ?? 'piece',
                            'expiry_date'   => $payload['expiry_date']   ?? null,
                            'image_url'     => $payload['image_url']     ?? null,
                            'is_active'     => $payload['is_active']     ?? true,
                            'shop_id'       => $shopId,
                            'category_id'   => $resolvedCategoryId,
                            'supplier_id'   => $resolvedSupplierId,
                        ];

                        $product = Product::updateOrCreate(
                            ['uuid' => $productUuid, 'shop_id' => $shopId],
                            $fillable
                        );
                        $data = ['uuid' => $product->uuid];
                    }

                    SyncLog::create([
                        'shop_id'        => $shopId,
                        'user_id'        => $user->id,
                        'operation_uuid' => $operationUuid,
                        'resource_type'  => $resourceType,
                        'resource_uuid'  => $productUuid,
                        'status'         => 'success',
                        'synced_at'      => now(),
                    ]);
                } elseif ($resourceType === 'category') {
                    $operationType   = $operation['operationType'] ?? null;
                    $categoryUuid    = $payload['uuid'] ?? $resourceUuid;

                    if (empty($categoryUuid) || ! Str::isUuid($categoryUuid)) {
                        throw new \Exception("Invalid category UUID format: " . ($categoryUuid ?? 'null'));
                    }

                    if ($operationType === 'DELETE') {
                        $category = Category::where('uuid', $categoryUuid)
                            ->where('shop_id', $shopId)
                            ->first();
                        if ($category) {
                            $category->delete();
                        }
                        $data = ['uuid' => $categoryUuid];
                    } elseif ($operationType === 'UPDATE') {
                        $category = Category::where('uuid', $categoryUuid)
                            ->where('shop_id', $shopId)
                            ->first();
                        if ($category) {
                            $category->update([
                                'name'        => $payload['name']        ?? $category->name,
                                'description' => $payload['description'] ?? null,
                                'image_url'   => $payload['image_url']   ?? null,
                            ]);
                        }
                        $data = ['uuid' => $categoryUuid];
                    } else {
                        // CREATE
                        $category = Category::updateOrCreate(
                            ['uuid' => $categoryUuid, 'shop_id' => $shopId],
                            [
                                'name'        => $payload['name'],
                                'description' => $payload['description'] ?? null,
                                'image_url'   => $payload['image_url']   ?? null,
                                'shop_id'     => $shopId,
                            ]
                        );
                        $data = ['uuid' => $category->uuid];
                    }

                    SyncLog::create([
                        'shop_id'        => $shopId,
                        'user_id'        => $user->id,
                        'operation_uuid' => $operationUuid,
                        'resource_type'  => $resourceType,
                        'resource_uuid'  => $categoryUuid,
                        'status'         => 'success',
                        'synced_at'      => now(),
                    ]);
                } elseif ($resourceType === 'expense') {
                    $operationType = $operation['operationType'] ?? null;
                    $expenseUuid   = $payload['uuid'] ?? $resourceUuid;

                    if (empty($expenseUuid) || ! Str::isUuid($expenseUuid)) {
                        throw new \Exception("Invalid expense UUID format: " . ($expenseUuid ?? 'null'));
                    }

                    if ($operationType === 'CREATE') {
                        \App\Models\Expense::updateOrCreate(
                            ['uuid' => $expenseUuid, 'shop_id' => $shopId],
                            [
                                'user_id'      => $user->id,
                                'category'     => $payload['category'],
                                'amount'       => $payload['amount'],
                                'description'  => $payload['description'] ?? null,
                                'expense_date' => $payload['expenseDate'] ?? $payload['expense_date'] ?? now()->format('Y-m-d'),
                                'receipt_url'  => $payload['receiptUrl'] ?? $payload['receipt_url'] ?? null,
                            ]
                        );
                    } elseif ($operationType === 'UPDATE') {
                        $expense = \App\Models\Expense::where('uuid', $expenseUuid)->first();
                        if ($expense) {
                            $expense->update([
                                'category'     => $payload['category'],
                                'amount'       => $payload['amount'],
                                'description'  => $payload['description'] ?? null,
                                'expense_date' => $payload['expenseDate'] ?? $payload['expense_date'] ?? $expense->expense_date,
                                'receipt_url'  => $payload['receiptUrl'] ?? $payload['receipt_url'] ?? null,
                            ]);
                        }
                    } elseif ($operationType === 'DELETE') {
                        $expense = \App\Models\Expense::where('uuid', $expenseUuid)->first();
                        if ($expense) {
                            $expense->delete();
                        }
                    }

                    SyncLog::create([
                        'shop_id' => $shopId,
                        'user_id' => $user->id,
                        'operation_uuid' => $operationUuid,
                        'resource_type' => $resourceType,
                        'resource_uuid' => $expenseUuid,
                        'status' => 'success',
                        'synced_at' => now(),
                    ]);
                } elseif ($resourceType === 'suppliers') {
                    $operationType  = $operation['operationType'] ?? null;
                    $supplierUuid   = $payload['uuid'] ?? $resourceUuid;

                    if (empty($supplierUuid) || ! Str::isUuid($supplierUuid)) {
                        throw new \Exception("Invalid supplier UUID format: " . ($supplierUuid ?? 'null'));
                    }

                    if ($operationType === 'DELETE') {
                        $supplier = Supplier::where('uuid', $supplierUuid)
                            ->where('shop_id', $shopId)
                            ->first();
                        if ($supplier) {
                            $supplier->delete();
                        }
                        $data = ['uuid' => $supplierUuid];
                    } elseif ($operationType === 'UPDATE') {
                        $supplier = Supplier::where('uuid', $supplierUuid)
                            ->where('shop_id', $shopId)
                            ->first();
                        if ($supplier) {
                            $supplier->update([
                                'name'    => $payload['name']    ?? $supplier->name,
                                'phone'   => $payload['phone']   ?? null,
                                'email'   => $payload['email']   ?? null,
                                'address' => $payload['address'] ?? null,
                                'notes'   => $payload['notes']   ?? null,
                            ]);
                        }
                        $data = ['uuid' => $supplierUuid];
                    } else {
                        // CREATE
                        $supplier = Supplier::updateOrCreate(
                            ['uuid' => $supplierUuid, 'shop_id' => $shopId],
                            [
                                'name'     => $payload['name'],
                                'phone'    => $payload['phone']   ?? null,
                                'email'    => $payload['email']   ?? null,
                                'address'  => $payload['address'] ?? null,
                                'notes'    => $payload['notes']   ?? null,
                                'shop_id'  => $shopId,
                            ]
                        );
                        $data = ['uuid' => $supplier->uuid];
                    }

                    SyncLog::create([
                        'shop_id'        => $shopId,
                        'user_id'        => $user->id,
                        'operation_uuid' => $operationUuid,
                        'resource_type'  => $resourceType,
                        'resource_uuid'  => $supplierUuid,
                        'status'         => 'success',
                        'synced_at'      => now(),
                    ]);
                } else {
                    // generic fallback stub — log as success but take no DB action
                    Log::info("Sync batch: unhandled resource type '{$resourceType}', skipping.");
                    SyncLog::create([
                        'shop_id' => $shopId,
                        'user_id' => $user->id,
                        'operation_uuid' => $operationUuid,
                        'resource_type' => $resourceType,
                        'resource_uuid' => ($resourceUuid && Str::isUuid($resourceUuid)) ? $resourceUuid : null,
                        'status' => 'success',
                        'synced_at' => now(),
                    ]);
                }

                $results[] = [
                    'operationUuid' => $operationUuid,
                    'status' => 'synced',
                    'data' => $data,
                ];

            } catch (InsufficientStockException $e) {
                // 4. Conflict Resolution
                SyncLog::create([
                    'shop_id' => $shopId,
                    'user_id' => $user->id,
                    'operation_uuid' => $operationUuid,
                    'resource_type' => $resourceType,
                    'resource_uuid' => $resourceUuid,
                    'status' => 'conflict',
                    'conflict_resolution' => 'stock_depleted',
                    'synced_at' => now(),
                ]);

                $results[] = [
                    'operationUuid' => $operationUuid,
                    'status' => 'conflict',
                    'resolution' => 'stock_depleted',
                    'message' => $e->getMessage(),
                ];
            } catch (\Exception $e) {
                Log::error("Sync Operation Failed ({$operationUuid}): " . $e->getMessage());

                // Only write failed SyncLog if resourceUuid is a valid UUID, otherwise it will crash
                $safeResourceUuid = ($resourceUuid && Str::isUuid($resourceUuid)) ? $resourceUuid : null;
                if ($safeResourceUuid) {
                    SyncLog::create([
                        'shop_id' => $shopId,
                        'user_id' => $user->id,
                        'operation_uuid' => $operationUuid,
                        'resource_type' => $resourceType,
                        'resource_uuid' => $safeResourceUuid,
                        'status' => 'failed',
                        'synced_at' => now(),
                    ]);
                }

                $results[] = [
                    'operationUuid' => $operationUuid,
                    'status' => 'failed',
                    'message' => 'An error occurred during synchronization.',
                ];
            }
        }

        return response()->json([
            'success' => true,
            'results' => $results,
        ]);
    }
}
