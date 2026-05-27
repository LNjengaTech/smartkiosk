// src/lib/db/dexie.ts
// Purpose: Singleton Dexie IndexedDB instance — the offline-first local database schema.
//          All tables mirror server models and include sync metadata fields.

import Dexie, { type Table } from 'dexie';
import type {
  SyncQueueEntry,
  LocalProduct,
  LocalCategory,
  LocalSale,
  LocalStockMovement,
  LocalExpense,
} from '@/types/db';

// ─── Database Class ───────────────────────────────────────────────────────────

class SmartKioskDatabase extends Dexie {
  // Typed table references — Dexie infers the key type from the schema
  syncQueue!: Table<SyncQueueEntry, number>;
  products!: Table<LocalProduct, number>;
  categories!: Table<LocalCategory, number>;
  sales!: Table<LocalSale, number>;
  stockMovements!: Table<LocalStockMovement, number>;
  expenses!: Table<LocalExpense, number>;

  constructor() {
    super('SmartKioskDB');

    /**
     * Schema Version 1 — Stage 1 Foundation
     *
     * Indices format: '++id' = auto-increment PK
     *                 'uuid' = unique indexed field
     *                 '[shopId+name]' = compound index
     *                 '&uuid' = unique constraint
     */
    this.version(1).stores({
      // FIFO synchronization queue — pending offline operations
      syncQueue: '++id, &operationUuid, resource, status, createdAt',

      // Local products catalog — indexed by barcode and shop scope
      products: '++id, &uuid, shopId, barcode, [shopId+isActive], [shopId+categoryId]',

      // Local categories — indexed by shop scope
      categories: '++id, &uuid, shopId, [shopId+name]',

      // Local sales — indexed by shop scope and date
      sales: '++id, &uuid, shopId, soldAt, [shopId+soldAt], syncedAt',

      // Stock movements — indexed by product and date
      stockMovements: '++id, &uuid, shopId, productId, [productId+occurredAt]',

      // Expenses — indexed by shop scope and date
      expenses: '++id, &uuid, shopId, expenseDate, [shopId+expenseDate]',
    });
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

// Lazy-initialized singleton — only created on first access (SSR safe)
let _db: SmartKioskDatabase | null = null;

export function getDb(): SmartKioskDatabase {
  if (typeof window === 'undefined') {
    throw new Error('Dexie IndexedDB is only available in the browser environment.');
  }
  if (!_db) {
    _db = new SmartKioskDatabase();
  }
  return _db;
}

/**
 * Convenient named export for direct use in client components.
 * Import as: import { db } from '@/lib/db/dexie';
 *
 * NOTE: Only use this in components/hooks that are guaranteed
 * to run in the browser (use 'use client' directive).
 */
export const db = new Proxy({} as SmartKioskDatabase, {
  get(_target, prop: string) {
    return getDb()[prop as keyof SmartKioskDatabase];
  },
});
