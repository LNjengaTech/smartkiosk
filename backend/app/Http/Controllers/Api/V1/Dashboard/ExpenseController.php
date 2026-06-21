<?php

// backend/app/Http/Controllers/Api/V1/Dashboard/ExpenseController.php
// Purpose: CRUD for expenses — shop-scoped, paginated, and containing totalAmount metadata.

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Expense\StoreExpenseRequest;
use App\Http\Requests\Api\V1\Expense\UpdateExpenseRequest;
use App\Http\Resources\Api\V1\ExpenseResource;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    /**
     * GET /api/v1/expenses
     * Scoped to the authenticated user's shop, paginated, with totalAmount metadata.
     */
    public function index(Request $request)
    {
        $shopId = $request->user()->shop_id;

        $query = Expense::forShop($shopId)->with('user');

        // Calculate total amount before pagination
        $totalAmount = (float) (clone $query)->sum('amount');

        $expenses = $query->orderBy('expense_date', 'desc')
            ->orderBy('id', 'desc')
            ->paginate($request->input('per_page', 15));

        return ExpenseResource::collection($expenses)->additional([
            'meta' => [
                'totalAmount' => $totalAmount,
            ]
        ]);
    }

    /**
     * POST /api/v1/expenses
     * Creates a new expense, automatically setting user_id and shop_id.
     */
    public function store(StoreExpenseRequest $request)
    {
        $expense = Expense::create([
            'uuid'         => $request->input('uuid'),
            'shop_id'      => $request->user()->shop_id,
            'user_id'      => $request->user()->id,
            'category'     => $request->category,
            'amount'       => $request->amount,
            'description'  => $request->description,
            'expense_date' => $request->expense_date,
            'receipt_url'  => $request->receipt_url,
        ]);

        return new ExpenseResource($expense->load('user'));
    }

    /**
     * GET /api/v1/expenses/{expense}
     * Shows a single expense.
     */
    public function show(Expense $expense)
    {
        // Route model binding handles EnsureShopAccess middleware
        return new ExpenseResource($expense->load('user'));
    }

    /**
     * PUT /api/v1/expenses/{expense}
     * Updates an existing expense.
     */
    public function update(UpdateExpenseRequest $request, Expense $expense)
    {
        $expense->update($request->validated());

        return new ExpenseResource($expense->load('user'));
    }

    /**
     * DELETE /api/v1/expenses/{expense}
     * Deletes an expense.
     */
    public function destroy(Expense $expense): JsonResponse
    {
        $expense->delete();

        return response()->json(null, 204);
    }
}
