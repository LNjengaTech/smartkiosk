<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/CategoryController.php
// Purpose: CRUD for product categories — owner and manager access only.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Category\StoreCategoryRequest;
use App\Http\Requests\Api\V1\Category\UpdateCategoryRequest;
use App\Http\Resources\Api\V1\CategoryResource;
use App\Models\Category;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    use ApiResponse;

    /**
     * GET /api/v1/categories
     * Return all categories for the authenticated user's shop, ordered by name.
     * Includes product count.
     */
    public function index(Request $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $categories = Category::query()
            ->where('shop_id', $shopId)
            ->withCount('products')
            ->orderBy('name', 'asc')
            ->get();

        return $this->success(
            CategoryResource::collection($categories),
            'Categories retrieved successfully.',
        );
    }

    /**
     * POST /api/v1/categories
     * Create a new category scoped to the authenticated user's shop.
     */
    public function store(StoreCategoryRequest $request): JsonResponse
    {
        $shopId = $request->user()->shop_id;

        $category = Category::create([
            'shop_id'     => $shopId,
            'name'        => $request->validated('name'),
            'description' => $request->validated('description'),
            'image_url'   => $request->validated('image_url'),
        ]);

        // Load product count for the resource
        $category->loadCount('products');

        return $this->created(
            new CategoryResource($category),
            'Category created successfully.',
        );
    }

    /**
     * PUT /api/v1/categories/{category}
     * Update an existing category. EnsureShopAccess middleware handles ownership check.
     */
    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        $category->update($request->validated());
        $category->loadCount('products');

        return $this->success(
            new CategoryResource($category),
            'Category updated successfully.',
        );
    }

    /**
     * DELETE /api/v1/categories/{category}
     * Soft-delete a category — blocked if it has any products.
     */
    public function destroy(Category $category): JsonResponse
    {
        if ($category->products()->count() > 0) {
            return $this->error(
                'Cannot delete a category that has products. Reassign or delete the products first.',
                400,
            );
        }

        $category->delete();

        return $this->noContent();
    }
}
