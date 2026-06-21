<?php

// backend/tests/Feature/ExpenseControllerTest.php
// Purpose: Feature tests verifying full V1 CRUD operations on expenses.

use App\Models\User;
use App\Models\Shop;
use App\Models\Expense;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    // Scaffold Spatie roles
    Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);

    // Scaffold Shop 1
    $this->shop1 = Shop::create([
        'uuid' => (string) Str::uuid(),
        'business_name' => 'First Retail Shop',
        'location' => 'Nairobi',
        'is_active' => true,
    ]);

    // Scaffold Shop 2
    $this->shop2 = Shop::create([
        'uuid' => (string) Str::uuid(),
        'business_name' => 'Second Retail Shop',
        'location' => 'Mombasa',
        'is_active' => true,
    ]);

    // Scaffold Owner for Shop 1
    $this->owner1 = User::create([
        'uuid' => (string) Str::uuid(),
        'name' => 'Owner One',
        'email' => 'owner1@test.com',
        'phone' => '+254711111111',
        'password' => Hash::make('Secret123!'),
        'shop_id' => $this->shop1->id,
        'is_active' => true,
    ]);
    $this->owner1->assignRole('owner');
    $this->shop1->update(['owner_id' => $this->owner1->id]);

    // Scaffold Owner for Shop 2
    $this->owner2 = User::create([
        'uuid' => (string) Str::uuid(),
        'name' => 'Owner Two',
        'email' => 'owner2@test.com',
        'phone' => '+254722222222',
        'password' => Hash::make('Secret123!'),
        'shop_id' => $this->shop2->id,
        'is_active' => true,
    ]);
    $this->owner2->assignRole('owner');
    $this->shop2->update(['owner_id' => $this->owner2->id]);
});

test('unauthenticated users cannot access expenses API', function () {
    $response = $this->getJson('/api/v1/expenses');
    $response->assertStatus(401);
});

test('index returns paginated, shop-scoped expenses and totalAmount meta', function () {
    // Generate expenses for shop 1
    Expense::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop1->id,
        'user_id' => $this->owner1->id,
        'category' => 'rent',
        'amount' => 15000.00,
        'expense_date' => '2026-06-01',
    ]);

    Expense::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop1->id,
        'user_id' => $this->owner1->id,
        'category' => 'electricity',
        'amount' => 4500.00,
        'expense_date' => '2026-06-02',
    ]);

    // Generate expense for shop 2
    Expense::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop2->id,
        'user_id' => $this->owner2->id,
        'category' => 'internet',
        'amount' => 3000.00,
        'expense_date' => '2026-06-01',
    ]);

    $token = $this->owner1->createToken('test-token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->getJson('/api/v1/expenses');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'uuid', 'category', 'amount', 'expenseDate', 'userName']
            ],
            'meta' => ['totalAmount'],
            'links',
        ])
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.totalAmount', 19500);

    // Verify it doesn't include Shop 2's internet expense
    $ids = collect($response['data'])->pluck('id');
    $shop2ExpenseId = Expense::where('shop_id', $this->shop2->id)->first()->id;
    expect($ids->contains((string) $shop2ExpenseId))->toBeFalse();
});

test('store creates expense and preserves UUID if supplied', function () {
    $token = $this->owner1->createToken('test-token')->plainTextToken;
    $customUuid = (string) Str::uuid();

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->postJson('/api/v1/expenses', [
            'uuid' => $customUuid,
            'category' => 'salary',
            'amount' => 25000.00,
            'description' => 'May sales attendant salary payouts',
            'expense_date' => '2026-06-20',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.uuid', $customUuid)
        ->assertJsonPath('data.category', 'salary')
        ->assertJsonPath('data.amount', 25000)
        ->assertJsonPath('data.userName', 'Owner One');

    $this->assertDatabaseHas('expenses', [
        'uuid' => $customUuid,
        'shop_id' => $this->shop1->id,
        'amount' => 25000.00,
    ]);
});

test('store validates future date and category bounds', function () {
    $token = $this->owner1->createToken('test-token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->postJson('/api/v1/expenses', [
            'category' => 'invalid-category',
            'amount' => -100,
            'expense_date' => '2030-01-01', // future date
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['category', 'amount', 'expense_date']);
});

test('update modifies expense attributes', function () {
    $expense = Expense::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop1->id,
        'user_id' => $this->owner1->id,
        'category' => 'rent',
        'amount' => 15000.00,
        'expense_date' => '2026-06-01',
    ]);

    $token = $this->owner1->createToken('test-token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->putJson("/api/v1/expenses/{$expense->id}", [
            'category' => 'rent',
            'amount' => 16000.00,
            'description' => 'Updated rent rate',
            'expense_date' => '2026-06-01',
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('data.amount', 16000)
        ->assertJsonPath('data.description', 'Updated rent rate');

    $this->assertDatabaseHas('expenses', [
        'id' => $expense->id,
        'amount' => 16000.00,
    ]);
});

test('destroy removes expense soft-deleting it', function () {
    $expense = Expense::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop1->id,
        'user_id' => $this->owner1->id,
        'category' => 'transport',
        'amount' => 1200.00,
        'expense_date' => '2026-06-10',
    ]);

    $token = $this->owner1->createToken('test-token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->deleteJson("/api/v1/expenses/{$expense->id}");

    $response->assertStatus(204);

    $this->assertSoftDeleted('expenses', [
        'id' => $expense->id,
    ]);
});

test('tenant middleware restricts update/delete cross-tenant access', function () {
    // Expense in Shop 2
    $expense = Expense::create([
        'uuid' => (string) Str::uuid(),
        'shop_id' => $this->shop2->id,
        'user_id' => $this->owner2->id,
        'category' => 'internet',
        'amount' => 3000.00,
        'expense_date' => '2026-06-01',
    ]);

    // Token for Owner in Shop 1
    $token = $this->owner1->createToken('test-token')->plainTextToken;

    // Try to update Shop 2's expense using Shop 1's token
    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->putJson("/api/v1/expenses/{$expense->id}", [
            'category' => 'internet',
            'amount' => 4000.00,
            'expense_date' => '2026-06-01',
        ]);

    // Should return 403 depending on EnsureShopAccess implementation
    $response->assertStatus(403);
});
