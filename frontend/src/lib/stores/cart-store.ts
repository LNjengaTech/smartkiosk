// src/lib/stores/cart-store.ts
// Purpose: Zustand store for POS cart state — items, payment, held carts.
//          Persisted to IndexedDB via Dexie for offline resilience (survives page refresh).

import { create } from 'zustand';
import { toast } from 'sonner';
import type { ProductResponse } from '@/types/api';
import type {
  CartItem,
  CartState,
  HeldCart,
  PaymentMethod,
  PaymentSplit,
} from '@/types/pos';

// ─── Constants ────────────────────────────────────────────────────────────────

const CART_DB_KEY = 1; // singleton row id in Dexie cart table

// ─── Actions Interface ────────────────────────────────────────────────────────

interface CartActions {
  addItem: (product: ProductResponse, quantity?: number) => void;
  removeItem: (productUuid: string) => void;
  updateQuantity: (productUuid: string, quantity: number) => void;
  clearCart: () => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setPaymentSplit: (split: Partial<PaymentSplit>) => void;
  setAmountPaid: (amount: number) => void;
  setMpesaReference: (ref: string) => void;
  setBankReference: (ref: string) => void;
  setNotes: (notes: string) => void;
  holdCart: (label?: string) => void;
  restoreHeldCart: (id: string) => void;
  deleteHeldCart: (id: string) => void;
  rehydrate: () => Promise<void>;

  // Computed (derived from items — not stored)
  getSubtotal: () => number;
  getTotal: () => number;
  getChange: () => number;
  getItemCount: () => number;
  canCompleteSale: () => boolean;
}

// ─── Full Store Type ──────────────────────────────────────────────────────────

type CartStore = CartState & CartActions;

// ─── Default State ────────────────────────────────────────────────────────────

const defaultState: CartState = {
  items: [],
  paymentMethod: 'cash',
  paymentSplit: { cash: 0, mpesa: 0, bank: 0 },
  amountPaid: 0,
  mpesaReference: null,
  bankReference: null,
  notes: null,
  heldCarts: [],
};

// ─── Dexie Persistence Helper ─────────────────────────────────────────────────

async function persistToDexie(state: CartState): Promise<void> {
  try {
    // Dynamic import guards against SSR — Dexie is browser-only
    const { db } = await import('@/lib/db/dexie');
    await db.cart.put({ id: CART_DB_KEY, state: JSON.stringify(state) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn('[CartStore] Failed to persist cart to Dexie:', message);
  }
}

// ─── Store Definition ─────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>((set, get) => ({
  ...defaultState,

  // ── Persistence ─────────────────────────────────────────────────────────────

  rehydrate: async () => {
    try {
      const { db } = await import('@/lib/db/dexie');
      const row = await db.cart.get(CART_DB_KEY);
      if (row?.state) {
        const saved = JSON.parse(row.state) as CartState;
        set({ ...saved });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[CartStore] Failed to rehydrate cart from Dexie:', message);
    }
  },

  // ── Cart Mutations ───────────────────────────────────────────────────────────

  addItem: (product, quantity = 1) => {
    const current = get();
    const existing = current.items.find((i) => i.productUuid === product.uuid);

    let nextItems: CartItem[];

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > existing.maxQuantity) {
        toast.warning('Maximum available stock reached', {
          description: `Only ${existing.maxQuantity} units of "${existing.name}" in stock.`,
        });
        return;
      }
      nextItems = current.items.map((i) =>
        i.productUuid === product.uuid ? { ...i, quantity: newQty } : i,
      );
    } else {
      if (quantity > product.quantity) {
        toast.warning('Maximum available stock reached', {
          description: `Only ${product.quantity} units of "${product.name}" in stock.`,
        });
        return;
      }
      const newItem: CartItem = {
        productId: product.id,
        productUuid: product.uuid,
        name: product.name,
        barcode: product.barcode,
        imageUrl: product.imageUrl,
        unitPrice: product.sellingPrice,
        buyingPrice: product.buyingPrice,
        quantity,
        maxQuantity: product.quantity,
        unit: product.unit,
      };
      nextItems = [...current.items, newItem];
    }

    const nextState = { ...current, items: nextItems };
    set(nextState);
    void persistToDexie(nextState);
  },

  removeItem: (productUuid) => {
    const current = get();
    const nextState = {
      ...current,
      items: current.items.filter((i) => i.productUuid !== productUuid),
    };
    set(nextState);
    void persistToDexie(nextState);
  },

  updateQuantity: (productUuid, quantity) => {
    const current = get();
    const item = current.items.find((i) => i.productUuid === productUuid);
    if (!item) return;

    if (quantity <= 0) {
      // Remove item when quantity reaches 0
      const nextState = {
        ...current,
        items: current.items.filter((i) => i.productUuid !== productUuid),
      };
      set(nextState);
      void persistToDexie(nextState);
      return;
    }

    if (quantity > item.maxQuantity) {
      toast.warning('Maximum available stock reached', {
        description: `Only ${item.maxQuantity} units of "${item.name}" in stock.`,
      });
      return;
    }

    const nextState = {
      ...current,
      items: current.items.map((i) =>
        i.productUuid === productUuid ? { ...i, quantity } : i,
      ),
    };
    set(nextState);
    void persistToDexie(nextState);
  },

  clearCart: () => {
    const current = get();
    const nextState: CartState = {
      ...defaultState,
      heldCarts: current.heldCarts, // held carts survive a clear
    };
    set(nextState);
    void persistToDexie(nextState);
  },

  // ── Payment Setters ──────────────────────────────────────────────────────────

  setPaymentMethod: (method) => {
    const nextState = { ...get(), paymentMethod: method, amountPaid: 0, mpesaReference: null, bankReference: null };
    set(nextState);
    void persistToDexie(nextState);
  },

  setPaymentSplit: (partial) => {
    const current = get();
    const nextSplit = { ...current.paymentSplit, ...partial };
    const nextState = { ...current, paymentSplit: nextSplit };
    set(nextState);
    void persistToDexie(nextState);
  },

  setAmountPaid: (amount) => {
    const nextState = { ...get(), amountPaid: amount };
    set(nextState);
    void persistToDexie(nextState);
  },

  setMpesaReference: (ref) => {
    const nextState = { ...get(), mpesaReference: ref };
    set(nextState);
    void persistToDexie(nextState);
  },

  setBankReference: (ref) => {
    const nextState = { ...get(), bankReference: ref };
    set(nextState);
    void persistToDexie(nextState);
  },

  setNotes: (notes) => {
    const nextState = { ...get(), notes };
    set(nextState);
    void persistToDexie(nextState);
  },

  // ── Held Carts ───────────────────────────────────────────────────────────────

  holdCart: async (label) => {
    const current = get();
    if (current.items.length === 0) {
      toast.info('Cart is empty', { description: 'Add items before holding the cart.' });
      return;
    }

    const { nanoid } = await import('nanoid');
    const held: HeldCart = {
      id: nanoid(),
      label: label ?? `Cart — ${new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}`,
      items: [...current.items],
      createdAt: new Date().toISOString(),
    };

    const nextState: CartState = {
      ...defaultState,
      heldCarts: [...current.heldCarts, held],
    };
    set(nextState);
    void persistToDexie(nextState);
    toast.success('Cart held', { description: `"${held.label}" saved. Start a new sale.` });
  },

  restoreHeldCart: (id) => {
    const current = get();
    const held = current.heldCarts.find((h) => h.id === id);
    if (!held) return;

    const nextState: CartState = {
      ...current,
      items: held.items,
      heldCarts: current.heldCarts.filter((h) => h.id !== id),
    };
    set(nextState);
    void persistToDexie(nextState);
    toast.success('Cart restored', { description: `"${held.label}" is now active.` });
  },

  deleteHeldCart: (id) => {
    const current = get();
    const nextState = {
      ...current,
      heldCarts: current.heldCarts.filter((h) => h.id !== id),
    };
    set(nextState);
    void persistToDexie(nextState);
  },

  // ── Computed Getters ─────────────────────────────────────────────────────────

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  },

  getTotal: () => {
    // No tax in Stage 3 — total equals subtotal
    return get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  },

  getChange: () => {
    const { amountPaid, paymentMethod, paymentSplit } = get();
    const total = get().getTotal();

    if (paymentMethod === 'mixed') {
      const totalPaid = paymentSplit.cash + paymentSplit.mpesa + paymentSplit.bank;
      return Math.max(0, totalPaid - total);
    }
    return Math.max(0, amountPaid - total);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  canCompleteSale: () => {
    const state = get();
    const total = state.getTotal();
    if (state.items.length === 0 || total <= 0) return false;

    if (state.paymentMethod === 'mixed') {
      const totalPaid = state.paymentSplit.cash + state.paymentSplit.mpesa + state.paymentSplit.bank;
      return totalPaid >= total;
    }
    return state.amountPaid >= total;
  },
}));
