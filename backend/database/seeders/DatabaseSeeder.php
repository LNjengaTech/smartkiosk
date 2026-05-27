<?php

// backend/database/seeders/DatabaseSeeder.php
// Purpose: Main database seeder. Establishes core system values, roles, plans, and tenant mock data.

namespace Database\Seeders;

use App\Models\Category;
use App\Models\PlatformConfig;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopSubscription;
use App\Models\StockMovement;
use App\Models\SubscriptionTier;
use App\Models\Supplier;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Reset Cached Roles & Permissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // 2. Seed Platform Config Singleton
        $config = PlatformConfig::instance();
        $this->command->info("Platform Configuration seeded: {$config->platform_name}");

        // 3. Seed Subscription Tiers
        $tiers = [
            [
                'name' => 'basic',
                'price_kes' => 1500.00,
                'product_limit' => 100,
                'branch_limit' => 1,
                'ai_token_limit' => 50,
                'features' => [
                    'ai_insights' => false,
                    'multi_branch' => false,
                    'custom_receipts' => false,
                    'supplier_balances' => true,
                ],
                'is_active' => true,
            ],
            [
                'name' => 'pro',
                'price_kes' => 3500.00,
                'product_limit' => 1000,
                'branch_limit' => 3,
                'ai_token_limit' => 250,
                'features' => [
                    'ai_insights' => true,
                    'multi_branch' => true,
                    'custom_receipts' => true,
                    'supplier_balances' => true,
                ],
                'is_active' => true,
            ],
            [
                'name' => 'enterprise',
                'price_kes' => 7500.00,
                'product_limit' => null, // unlimited
                'branch_limit' => null,
                'ai_token_limit' => null,
                'features' => [
                    'ai_insights' => true,
                    'multi_branch' => true,
                    'custom_receipts' => true,
                    'supplier_balances' => true,
                    'enterprise_support' => true,
                ],
                'is_active' => true,
            ],
        ];

        foreach ($tiers as $tierData) {
            SubscriptionTier::updateOrCreate(['name' => $tierData['name']], $tierData);
        }
        $this->command->info('Subscription Tiers seeded.');

        // 4. Seed Spatie RBAC Roles
        $roles = ['super_admin', 'owner', 'manager', 'cashier'];
        foreach ($roles as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
        }
        $this->command->info('Spatie RBAC Roles seeded.');

        // 5. Seed Super Admin User (No shop)
        $superAdmin = User::updateOrCreate(
            ['email' => 'superadmin@smartkiosk.app'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'System Super Admin',
                'phone' => '+254700000000',
                'password' => Hash::make('Password123!'),
                'is_active' => true,
                'email_verified_at' => Carbon::now(),
            ]
        );
        $superAdmin->assignRole('super_admin');
        $this->command->info('Super Admin user seeded: superadmin@smartkiosk.app');

        // 6. Seed a Default Tenant Shop
        $shop = Shop::updateOrCreate(
            ['email' => 'contact@bakhresa.com'],
            [
                'uuid' => (string) Str::uuid(),
                'business_name' => 'Bakhresa Kiosk',
                'location' => 'Mombasa Town',
                'phone' => '+254711223344',
                'currency' => 'KES',
                'timezone' => 'Africa/Nairobi',
                'is_active' => true,
            ]
        );

        // 7. Seed Shop Owner User
        $owner = User::updateOrCreate(
            ['email' => 'owner@bakhresa.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Said Bakhresa',
                'phone' => '+254722334455',
                'password' => Hash::make('Password123!'),
                'shop_id' => $shop->id,
                'is_active' => true,
                'email_verified_at' => Carbon::now(),
            ]
        );
        $owner->assignRole('owner');

        // Link Owner to Shop
        $shop->update(['owner_id' => $owner->id]);
        $this->command->info('Tenant Shop Owner user seeded: owner@bakhresa.com');

        // 8. Seed Shop Active Subscription (Pro Tier)
        ShopSubscription::updateOrCreate(
            ['shop_id' => $shop->id],
            [
                'plan' => 'pro',
                'trial_ends_at' => Carbon::now()->addDays(14),
                'subscription_ends_at' => Carbon::now()->addMonth(),
                'is_active' => true,
            ]
        );
        $this->command->info('Shop Subscription (Pro Tier) seeded.');

        // 9. Seed Shop Staff Users (Manager and Cashier)
        $manager = User::updateOrCreate(
            ['email' => 'manager@bakhresa.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'John Kiosk Manager',
                'phone' => '+254733445566',
                'password' => Hash::make('Password123!'),
                'shop_id' => $shop->id,
                'is_active' => true,
                'email_verified_at' => Carbon::now(),
            ]
        );
        $manager->assignRole('manager');

        $cashier = User::updateOrCreate(
            ['email' => 'cashier@bakhresa.com'],
            [
                'uuid' => (string) Str::uuid(),
                'name' => 'Mary Cashier',
                'phone' => '+254744556677',
                'password' => Hash::make('Password123!'),
                'shop_id' => $shop->id,
                'is_active' => true,
                'email_verified_at' => Carbon::now(),
            ]
        );
        $cashier->assignRole('cashier');
        $this->command->info('Shop Staff (Manager & Cashier) seeded.');

        // 10. Seed Inventory Dummy Data (Category and Supplier)
        $category = Category::updateOrCreate(
            [
                'shop_id' => $shop->id,
                'name' => 'Beverages',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'description' => 'Soft drinks, soda, juices and bottled water',
            ]
        );

        $supplier = Supplier::updateOrCreate(
            [
                'shop_id' => $shop->id,
                'name' => 'Coca-Cola Beverages Africa',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'phone' => '+254206978000',
                'email' => 'orders@ccba.co.ke',
                'address' => 'Likoni Road, Nairobi',
                'balance' => -12500.00, // We owe the supplier KES 12,500
                'notes' => 'Weekly soda and water supplier deliveries',
            ]
        );
        $this->command->info('Inventory Category and Supplier seeded.');

        // 11. Seed a Product with StockMovement (Coca-Cola 500ml)
        $product = Product::updateOrCreate(
            [
                'shop_id' => $shop->id,
                'name' => 'Coca-Cola 500ml',
            ],
            [
                'uuid' => (string) Str::uuid(),
                'category_id' => $category->id,
                'supplier_id' => $supplier->id,
                'sku' => 'CC-500ML',
                'barcode' => '6001108000088',
                'buying_price' => 50.00,
                'selling_price' => 70.00,
                'quantity' => 150.000,
                'reorder_level' => 20.000,
                'unit' => 'piece',
                'expiry_date' => Carbon::now()->addMonths(6)->toDateString(),
                'is_active' => true,
            ]
        );

        // Record Initial Stock Entry Movement
        StockMovement::updateOrCreate(
            ['uuid' => (string) Str::uuid()],
            [
                'shop_id' => $shop->id,
                'product_id' => $product->id,
                'user_id' => $manager->id,
                'movement_type' => 'stock_in',
                'delta' => 150.000,
                'quantity_before' => 0.000,
                'quantity_after' => 150.000,
                'unit_cost' => 50.00,
                'notes' => 'Initial bulk stock-in delivery from Coca-Cola CCBA.',
                'occurred_at' => Carbon::now(),
            ]
        );
        $this->command->info('Product seeded with initial Stock In Movement.');
    }
}
