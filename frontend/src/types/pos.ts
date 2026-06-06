// src/types/pos.ts
// Purpose: All POS-specific TypeScript interfaces — cart, sale, receipt, payment.

// ─── Cart Item ────────────────────────────────────────────────────────────────

export interface CartItem {
  productId: string
  productUuid: string
  name: string            // snapshot at time of adding to cart
  barcode: string | null
  imageUrl: string | null
  unitPrice: number       // snapshot — selling_price at time of adding
  buyingPrice: number     // snapshot — for profit calculation
  quantity: number
  maxQuantity: number     // current stock level — enforced client-side
  unit: 'piece' | 'kg' | 'litre' | 'pack'
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'mpesa' | 'bank' | 'mixed'

export interface PaymentSplit {
  cash: number
  mpesa: number
  bank: number
}

// ─── Cart State ───────────────────────────────────────────────────────────────

export interface CartState {
  items: CartItem[]
  paymentMethod: PaymentMethod
  paymentSplit: PaymentSplit
  amountPaid: number
  mpesaReference: string | null
  bankReference: string | null
  notes: string | null
  heldCarts: HeldCart[]
}

export interface HeldCart {
  id: string            // nanoid
  label: string         // e.g. "Customer 1" or timestamp
  items: CartItem[]
  createdAt: string
}

// ─── Sale Payload (sent to server / sync engine) ──────────────────────────────

export interface SalePayload {
  uuid: string                  // client-generated
  shopId: string
  userId: string
  items: SaleItemPayload[]
  paymentMethod: PaymentMethod
  paymentSplit: PaymentSplit
  amountPaid: number
  mpesaReference: string | null
  bankReference: string | null
  notes: string | null
  soldAt: string                // ISO — client timestamp (offline-safe)
}

export interface SaleItemPayload {
  uuid: string
  productUuid: string
  productName: string           // snapshot
  quantity: number
  unitPrice: number             // snapshot
  buyingPrice: number           // snapshot
  discount: number
  total: number
}

// ─── Receipt ──────────────────────────────────────────────────────────────────

export interface ReceiptData {
  receiptNumber: string
  shopName: string
  shopLocation: string | null
  shopPhone: string | null
  items: ReceiptItem[]
  subtotal: number
  discountAmount: number
  totalAmount: number
  amountPaid: number
  changeAmount: number
  paymentMethod: PaymentMethod
  mpesaReference: string | null
  cashierName: string
  soldAt: string
}

export interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  total: number
}
