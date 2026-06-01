<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/SupplierController.php
// Purpose: CRUD for suppliers — owner access only.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Supplier\StoreSupplierRequest;
use App\Http\Requests\Api\V1\Supplier\UpdateSupplierRequest;
use App\Http\Resources\Api\V1\SupplierResource;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;

class SupplierController extends Controller
{
    public function index()
    {
        $suppliers = Supplier::forShop(auth()->user()->shop_id)
            ->withCount(['products', 'stockMovements'])
            ->orderBy('name', 'asc')
            ->get();

        return SupplierResource::collection($suppliers);
    }

    public function store(StoreSupplierRequest $request)
    {
        $supplier = Supplier::create([
            'shop_id' => auth()->user()->shop_id,
            'name' => $request->name,
            'phone' => $request->phone,
            'email' => $request->email,
            'address' => $request->address,
            'notes' => $request->notes,
            'balance' => 0,
        ]);

        return new SupplierResource($supplier->loadCount(['products', 'stockMovements']));
    }

    public function show(Supplier $supplier)
    {
        return new SupplierResource($supplier->loadCount(['products', 'stockMovements']));
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier)
    {
        $supplier->update($request->validated());

        return new SupplierResource($supplier->loadCount(['products', 'stockMovements']));
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        if ($supplier->products()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Supplier has linked products. Unlink products before deleting.'
            ], 400);
        }

        $supplier->delete();

        return response()->json(null, 204);
    }
}
