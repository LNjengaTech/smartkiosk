// src/types/db.ts
// Purpose: TypeScript interfaces for Dexie IndexedDB offline-first local schema.
//          These mirror server-side models but are adapted for client-side storage.

import type { PaymentMethod, SaleStatus, MovementType, ProductUnit, ExpenseCategory } from './api';

// ─── Sync Queue Entry ────────────────────────────────────────────────────────

export type SyncQueueStatus = 'pending' | 'processing' | 'failed';
export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncQueueEntry {
  id?: number;           // Dexie auto-increment key
  operationUuid: string; // NanoID — sent as idempotency key to backend
  resource: string;      // e.g. 'sale', 'stock_movement', 'expense'
  operation: SyncOperationType;
  payload: unknown;      // Serialized resource body
  status: SyncQueueStatus;
  retries: number;
  createdAt: string;     // ISO string
  lastAttemptAt: string | null;
  error: string | null;
}

// ─── Local Product ────────────────────────────────────────────────────────────

export interface LocalProduct {
  id?: number;
  uuid: string;
  shopId: number;
  categoryId: number | null;
  supplierId: number | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  buyingPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  unit: ProductUnit;
  expiryDate: string | null;
  imageUrl: string | null;
  isActive: boolean;
  syncedAt: string | null;
  updatedAt?: string;
}

// ─── Local Category ───────────────────────────────────────────────────────────

export interface LocalCategory {
  id?: number;
  uuid: string;
  shopId: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  syncedAt: string | null;
}

// ─── Local Sale (POS Pending Transaction) ─────────────────────────────────────

export interface LocalSaleItem {
  uuid: string;
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  buyingPrice: number;
  discount: number;
  total: number;
}

export interface LocalSale {
  id?: number;
  uuid: string;
  shopId: number;
  userId: number;
  receiptNumber: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: PaymentMethod;
  mpesaReference: string | null;
  status: SaleStatus;
  notes: string | null;
  items: LocalSaleItem[];
  soldAt: string;
  syncedAt: string | null;
  createdAt: string;
}

// ─── Local Stock Movement ─────────────────────────────────────────────────────

export interface LocalStockMovement {
  id?: number;
  uuid: string;
  shopId: number;
  productId: number;
  userId: number;
  movementType: MovementType;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number | null;
  notes: string | null;
  occurredAt: string;
  syncedAt: string | null;
  createdAt: string;
}

// ─── Local Expense ────────────────────────────────────────────────────────────

export interface LocalExpense {
  id?: number;
  uuid: string;
  shopId: number;
  userId: number;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  expenseDate: string;
  syncedAt: string | null;
  createdAt: string;
}
// ─── Local Supplier ───────────────────────────────────────────────────────────

export interface LocalSupplier {
  id?: number;
  uuid: string;
  shopId: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  syncedAt: string | null;
}
