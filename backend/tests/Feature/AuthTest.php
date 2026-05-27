<?php
// backend/tests/Feature/AuthTest.php
// Purpose: Feature tests verifying full V1 user authentication flows.

use App\Models\User;
use App\Models\Shop;
use Spatie\Permission\Models\Role;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Instruct Pest to use TestCase and RefreshDatabase for all feature tests in this file
uses(TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    // Scaffold Spatie roles
    Role::firstOrCreate(['name' => 'owner', 'guard_name' => 'web']);
    Role::firstOrCreate(['name' => 'cashier', 'guard_name' => 'web']);

    // Scaffold a shop tenant
    $this->shop = Shop::create([
        'uuid' => (string) Str::uuid(),
        'business_name' => 'Test Retail Shop',
        'location' => 'Nairobi',
        'is_active' => true,
    ]);

    // Scaffold a tenant owner user
    $this->owner = User::create([
        'uuid' => (string) Str::uuid(),
        'name' => 'Test Owner',
        'email' => 'owner@test.com',
        'phone' => '+254711111111',
        'password' => Hash::make('Secret123!'),
        'shop_id' => $this->shop->id,
        'is_active' => true,
    ]);
    $this->owner->assignRole('owner');

    // Assign owner to shop
    $this->shop->update(['owner_id' => $this->owner->id]);
});

test('login rejects invalid user credentials', function () {
    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'owner@test.com',
        'password' => 'WrongPassword!',
    ]);

    $response->assertStatus(401)
        ->assertJson([
            'success' => false,
            'message' => 'Invalid email or password credentials.',
        ]);
});

test('login rejects inactive user accounts', function () {
    $this->owner->update(['is_active' => false]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'owner@test.com',
        'password' => 'Secret123!',
    ]);

    $response->assertStatus(403)
        ->assertJson([
            'success' => false,
            'message' => 'Your account is currently deactivated. Please contact support.',
        ]);
});

test('login rejects users belonging to suspended shops', function () {
    $this->shop->update(['is_active' => false]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'owner@test.com',
        'password' => 'Secret123!',
    ]);

    $response->assertStatus(403)
        ->assertJson([
            'success' => false,
            'message' => 'Your shop account is currently suspended. Please contact billing.',
        ]);
});

test('login accepts valid credentials and returns profile with Sanctum tokens', function () {
    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'owner@test.com',
        'password' => 'Secret123!',
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'success',
            'data' => [
                'user' => [
                    'uuid',
                    'name',
                    'email',
                    'phone',
                    'roles',
                    'permissions',
                ],
                'shop' => [
                    'uuid',
                    'business_name',
                    'location',
                    'currency',
                    'timezone',
                ],
                'token',
                'token_type',
            ],
            'message',
        ])
        ->assertJsonPath('data.user.email', 'owner@test.com')
        ->assertJsonPath('data.shop.business_name', 'Test Retail Shop');

    expect($response['data']['token'])->not->toBeEmpty();
});

test('authenticated user can fetch profile details via me endpoint', function () {
    $token = $this->owner->createToken('test-token')->plainTextToken;

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->getJson('/api/v1/auth/me');

    $response->assertStatus(200)
        ->assertJsonStructure([
            'success',
            'data' => [
                'user' => [
                    'uuid',
                    'name',
                    'email',
                    'phone',
                    'roles',
                    'permissions',
                ],
                'shop' => [
                    'uuid',
                    'business_name',
                    'location',
                    'currency',
                    'timezone',
                ],
            ],
        ])
        ->assertJsonPath('data.user.email', 'owner@test.com');
});

test('unauthenticated request to protected me endpoint fails', function () {
    $response = $this->getJson('/api/v1/auth/me');

    $response->assertStatus(401)
        ->assertJson([
            'success' => false,
            'message' => 'Unauthenticated.',
        ]);
});

test('authenticated user can successfully logout and revoke session token', function () {
    $token = $this->owner->createToken('test-token')->plainTextToken;
    expect($this->owner->tokens()->count())->toBe(1);

    $response = $this->withHeader('Authorization', 'Bearer ' . $token)
        ->postJson('/api/v1/auth/logout');

    $response->assertStatus(200)
        ->assertJson([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);

    expect($this->owner->fresh()->tokens()->count())->toBe(0);
});
