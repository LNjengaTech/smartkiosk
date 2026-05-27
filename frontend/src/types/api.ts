// src/types/api.ts
// Purpose: Canonical TypeScript interfaces matching the Laravel API JSON contract.

// ─── Standard API Response Envelope ─────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  error_id?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  message: string;
}

// ─── Auth & Session ──────────────────────────────────────────────────────────

export interface UserRole {
  id: number;
  name: 'super_admin' | 'owner' | 'manager' | 'cashier';
  guard_name: string;
}

export type RoleName = 'super_admin' | 'owner' | 'manager' | 'cashier';

export interface AuthUser {
  uuid: string;
  name: string;
  email: string;
  phone: string | null;
  roles: RoleName[];
  permissions: string[];
}

export interface AuthShop {
  uuid: string;
  business_name: string;
  location: string | null;
  currency: string;
  timezone: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
  shop: AuthShop | null;
  token: string;
  token_type: 'Bearer';
}

export interface MeResponse {
  user: AuthUser;
  shop: AuthShop | null;
}

// ─── Products ────────────────────────────────────────────────────────────────

export type ProductUnit = 'piece' | 'kg' | 'litre' | 'pack';

export interface Product {
  id: number;
  uuid: string;
  shop_id: number;
  category_id: number | null;
  supplier_id: number | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  buying_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  unit: ProductUnit;
  expiry_date: string | null;
  image_url: string | null;
  is_active: boolean;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Categories ──────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  uuid: string;
  shop_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export interface Supplier {
  id: number;
  uuid: string;
  shop_id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'mpesa' | 'bank' | 'mixed';
export type SaleStatus = 'completed' | 'voided' | 'refunded';

export interface SaleItem {
  id: number;
  uuid: string;
  sale_id: number;
  product_id: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  buying_price: number;
  discount: number;
  total: number;
  created_at: string;
}

export interface Sale {
  id: number;
  uuid: string;
  shop_id: number;
  user_id: number;
  receipt_number: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  change_amount: number;
  payment_method: PaymentMethod;
  mpesa_reference: string | null;
  status: SaleStatus;
  notes: string | null;
  sold_at: string;
  synced_at: string | null;
  items?: SaleItem[];
  created_at: string;
  updated_at: string;
}

// ─── Stock Movements ─────────────────────────────────────────────────────────

export type MovementType =
  | 'stock_in'
  | 'stock_out'
  | 'sale'
  | 'adjustment'
  | 'damage'
  | 'transfer';

export interface StockMovement {
  id: number;
  uuid: string;
  shop_id: number;
  product_id: number;
  user_id: number;
  movement_type: MovementType;
  delta: number;
  quantity_before: number;
  quantity_after: number;
  unit_cost: number | null;
  reference_id: number | null;
  reference_type: string | null;
  notes: string | null;
  occurred_at: string;
  synced_at: string | null;
  created_at: string;
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'electricity'
  | 'internet'
  | 'transport'
  | 'maintenance'
  | 'other';

export interface Expense {
  id: number;
  uuid: string;
  shop_id: number;
  user_id: number;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  expense_date: string;
  receipt_url: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export type PlanName = 'basic' | 'pro' | 'enterprise';

export interface ShopSubscription {
  id: number;
  shop_id: number;
  plan: PlanName;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
