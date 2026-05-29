// frontend/src/lib/product-completeness.ts
// Purpose: Computes a 0–100 completeness score for a product based on data quality.
//          Pure function — no side effects, no API calls.

import type { ProductResponse } from '@/types/api';

export interface CompletenessHint {
  label: string;
  points: number;
}

export interface CompletenessResult {
  score: number;
  missing: CompletenessHint[];
}

export function computeCompleteness(product: ProductResponse): CompletenessResult {
  let score = 0;
  const missing: CompletenessHint[] = [];

  // Has image_url (25 pts)
  if (product.imageUrl && product.imageUrl.trim() !== '') {
    score += 25;
  } else {
    missing.push({ label: 'Add a product image', points: 25 });
  }

  // Has barcode (20 pts)
  if (product.barcode && product.barcode.trim() !== '') {
    score += 20;
  } else {
    missing.push({ label: 'Add a barcode', points: 20 });
  }

  // Has category (15 pts)
  if (product.categoryId !== null || product.category !== null) {
    score += 15;
  } else {
    missing.push({ label: 'Assign a category', points: 15 });
  }

  // selling_price > 0 (15 pts)
  if (product.sellingPrice > 0) {
    score += 15;
  } else {
    missing.push({ label: 'Set selling price greater than 0', points: 15 });
  }

  // buying_price > 0 (10 pts)
  if (product.buyingPrice > 0) {
    score += 10;
  } else {
    missing.push({ label: 'Set buying price greater than 0', points: 10 });
  }

  // Has SKU (8 pts)
  if (product.sku && product.sku.trim() !== '') {
    score += 8;
  } else {
    missing.push({ label: 'Add a stock keeping unit (SKU)', points: 8 });
  }

  // reorder_level > 0 (7 pts)
  if (product.reorderLevel > 0) {
    score += 7;
  } else {
    missing.push({ label: 'Set a reorder level alert threshold', points: 7 });
  }

  // Has expiry_date (0 pts - optional, shown as a hint only)
  if (!product.expiryDate) {
    missing.push({ label: 'Add an expiry date (optional recommendation)', points: 0 });
  }

  return {
    score,
    missing,
  };
}
