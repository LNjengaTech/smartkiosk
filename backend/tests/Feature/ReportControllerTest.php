<?php

// backend/tests/Feature/ReportControllerTest.php
// Purpose: Feature tests verifying report and intelligence analytics endpoints.

use App\Models\Category;
use App\Models\Expense;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    // Clear Spatie cache to avoid stale role resolution in tests
    app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();

    // Scaffold roles for web guard (default for User model)
    Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);

    // Create Shop
    $this->shop = Shop::create([
        'uuid' => (string) Str::uuid(),
        'business_name' => 'Test Analytics Shop',
        'location' => 'Mombasa',
        'is_active' => true,
    ]);

    // Create Owner User
    $this->owner = User::create([
        'uuid' => (string) Str::uuid(),
        'name' => 'Shop Owner',
        'email' => 'owner@analytics.com',
        'phone' => '+254722222222',
        'password' => Hash::make('Secret123!'),
        'shop_id' => $this->shop->id,
        'is_active' => true,
    ]);
    $this->owner->assignRole('owner');
    $this->shop->update(['owner_id' => $this->owner->id]);

    // Create Manager User
    $this->manager = User::create([
        'uuid' => (string) Str::uuid(),
        'name' => 'Shop Manager',
        'email' => 'manager@analytics.com',
        'phone' => '+254733333333',
        'password' => Hash::make('Secret123!'),
        'shop_id' => $this->shop->id,
        'is_active' => true,
    ]);
    $this->manager->assignRole('manager');

    // Create Cashier User
    $this->cashier = User::create([
        'uuid' => (string) Str::uuid(),
        'name' => 'Shop Cashier',
        'email' => 'cashier@analytics.com',
        'phone' => '+254744444444',
        'password' => Hash::make('Secret123!'),
        'shop_id' => $this->shop->id,
        'is_active' => true,
    ]);
    $this->cashier->assignRole('cashier');

    // Create Category
    $this->category = Category::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop->id,
        'name' => 'Groceries',
    ]);

    // Create Products
    $this->product1 = Product::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop->id,
        'category_id' => $this->category->id,
        'name' => 'Cooking Oil',
        'buying_price' => 150.00,
        'selling_price' => 200.00,
        'quantity' => 10,
        'reorder_level' => 5,
        'unit' => 'litre',
        'is_active' => true,
    ]);

    $this->product2 = Product::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop->id,
        'category_id' => $this->category->id,
        'name' => 'Sugar',
        'buying_price' => 100.00,
        'selling_price' => 130.00,
        'quantity' => 3, // low stock!
        'reorder_level' => 5,
        'unit' => 'kg',
        'is_active' => true,
    ]);

    // Create a Completed Sale (today)
    $this->sale = Sale::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop->id,
        'user_id' => $this->cashier->id,
        'receipt_number' => 'SK-2026-000001',
        'subtotal' => 330.00,
        'total_amount' => 330.00,
        'amount_paid' => 350.00,
        'change_amount' => 20.00,
        'payment_method' => 'cash',
        'status' => 'completed',
        'sold_at' => Carbon::now(),
    ]);

    SaleItem::create([
        'uuid' => (string) Str::uuid(),
        'sale_id' => $this->sale->id,
        'product_id' => $this->product1->id,
        'product_name' => $this->product1->name,
        'quantity' => 1.0,
        'unit_price' => 200.00,
        'buying_price' => 150.00,
        'total' => 200.00,
    ]);

    SaleItem::create([
        'uuid' => (string) Str::uuid(),
        'sale_id' => $this->sale->id,
        'product_id' => $this->product2->id,
        'product_name' => $this->product2->name,
        'quantity' => 1.0,
        'unit_price' => 130.00,
        'buying_price' => 100.00,
        'total' => 130.00,
    ]);

    // Create an Expense
    $this->expense = Expense::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop->id,
        'user_id' => $this->owner->id,
        'category' => 'electricity',
        'amount' => 1200.00,
        'description' => 'Tokens',
        'expense_date' => Carbon::today()->toDateString(),
    ]);
});

test('dashboard summary can be retrieved by manager', function () {
    $token = $this->manager->createToken('test-token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->getJson('/api/v1/reports/dashboard');

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonStructure([
            'success',
            'data' => [
                'todayRevenue',
                'todayOrderCount',
                'todayProfit',
                'todayProfitMargin',
                'lowStockCount',
                'outOfStockCount',
                'expiringSoonCount',
                'topProductsToday',
                'recentTransactions',
                'comparedToYesterday' => [
                    'revenueChange',
                    'orderCountChange',
                ],
            ],
        ])
        ->assertJsonPath('data.todayRevenue', 330)
        ->assertJsonPath('data.todayProfit', 80) // 330 revenue - 250 cogs = 80 profit
        ->assertJsonPath('data.lowStockCount', 1); // product2 has qty 3 which is <= reorder 5
});

test('sales report filters by date range and groups correctly', function () {
    $token = $this->manager->createToken('test-token')->plainTextToken;

    $from = Carbon::today()->toDateString();
    $to = Carbon::today()->toDateString();

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->getJson("/api/v1/reports/sales?from={$from}&to={$to}&group_by=day");

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonStructure([
            'success',
            'data' => [
                'period' => ['from', 'to'],
                'totalRevenue',
                'totalOrders',
                'totalProfit',
                'averageOrderValue',
                'dataPoints' => [
                    '*' => ['date', 'revenue', 'orderCount', 'profit'],
                ],
                'paymentBreakdown',
            ],
        ])
        ->assertJsonPath('data.totalRevenue', 330)
        ->assertJsonPath('data.totalOrders', 1);
});

test('profit report is restricted from managers', function () {
    $managerToken = $this->manager->createToken('test-token')->plainTextToken;
    $from = Carbon::today()->toDateString();
    $to = Carbon::today()->toDateString();

    $response = $this->withHeader('Authorization', 'Bearer ' . $managerToken)
        ->getJson("/api/v1/reports/profit?from={$from}&to={$to}");

    $response->assertStatus(403);
});

test('profit report can be retrieved by owners', function () {
    $ownerToken = $this->owner->createToken('test-token')->plainTextToken;
    $from = Carbon::today()->toDateString();
    $to = Carbon::today()->toDateString();

    $response = $this->withHeader('Authorization', 'Bearer ' . $ownerToken)
        ->getJson("/api/v1/reports/profit?from={$from}&to={$to}");

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonStructure([
            'success',
            'data' => [
                'period' => ['from', 'to'],
                'grossRevenue',
                'costOfGoodsSold',
                'grossProfit',
                'grossMargin',
                'topProfitProducts',
                'dailyProfit',
            ],
        ])
        ->assertJsonPath('data.grossProfit', 80)
        ->assertJsonPath('data.costOfGoodsSold', 250);
});

test('attendants performance report registers sales and void counts', function () {
    $token = $this->manager->createToken('test-token')->plainTextToken;
    $from = Carbon::today()->toDateString();
    $to = Carbon::today()->toDateString();

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->getJson("/api/v1/reports/attendants?from={$from}&to={$to}");

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonStructure([
            'success',
            'data' => [
                '*' => [
                    'userId',
                    'name',
                    'salesCount',
                    'totalRevenue',
                    'voidCount',
                    'voidRate',
                    'averageOrderValue',
                ],
            ],
        ]);
});

test('stock valuation aggregates totals', function () {
    $token = $this->manager->createToken('test-token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->getJson('/api/v1/reports/stock');

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.totalValue', 1800) // (10 * 150) + (3 * 100) = 1500 + 300 = 1800
        ->assertJsonPath('data.totalProducts', 2);
});

test('expenses report aggregates by category', function () {
    $token = $this->manager->createToken('test-token')->plainTextToken;
    $from = Carbon::today()->toDateString();
    $to = Carbon::today()->toDateString();

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->getJson("/api/v1/reports/expenses?from={$from}&to={$to}");

    $response->assertStatus(200)
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.totalExpenses', 1200)
        ->assertJsonStructure([
            'success',
            'data' => [
                'period' => ['from', 'to'],
                'totalExpenses',
                'byCategory' => [
                    '*' => ['category', 'total', 'count', 'percentage'],
                ],
            ],
        ]);
});

test('reports can be exported to CSV', function () {
    $token = $this->manager->createToken('test-token')->plainTextToken;
    $from = Carbon::today()->toDateString();
    $to = Carbon::today()->toDateString();

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->get("/api/v1/reports/export?type=sales&from={$from}&to={$to}");

    $response->assertStatus(200)
        ->assertHeader('Content-Type', 'text/csv; charset=utf-8')
        ->assertHeader('Content-Disposition', 'attachment; filename="smartkiosk-sales-' . Carbon::now()->toDateString() . '.csv"');
});
