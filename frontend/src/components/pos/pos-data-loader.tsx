'use client';

// src/components/pos/pos-data-loader.tsx
// Purpose: Client component that pre-loads all shop products into IndexedDB
//          on POS mount. Ensures SmartScan works fully offline.
//          Renders null — no visible UI.

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useSyncStore } from '@/lib/stores/sync-store';
import type { LocalProduct, LocalCategory } from '@/types/db';

// ─── Constants ────────────────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 5 * 60 * 1_000; // 5 minutes

// ─── Component ────────────────────────────────────────────────────────────────

export function PosDataLoader() {
  const { lastSyncedAt, setLastSyncedAt } = useSyncStore();
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Guard: only run once per mount, and only in the browser
    if (hasFetchedRef.current || typeof window === 'undefined') return;
    hasFetchedRef.current = true;

    const isFirstLoad = !lastSyncedAt;
    const isStale =
      !lastSyncedAt ||
      Date.now() - new Date(lastSyncedAt).getTime() > STALE_THRESHOLD_MS;

    if (!isStale) return;

    void (async () => {
      try {
        const { db } = await import('@/lib/db/dexie');
        const apiClient = (await import('@/lib/api/client')).default;

        // ── 1. Fetch all active products ───────────────────────────────────────
        const productsRes = await apiClient.get<{
          success: boolean;
          data: { data: Array<{
            id: string;
            uuid: string;
            shopId: string;
            categoryId: string | null;
            supplierId: string | null;
            name: string;
            sku: string | null;
            barcode: string | null;
            buyingPrice: number;
            sellingPrice: number;
            quantity: number;
            reorderLevel: number;
            unit: 'piece' | 'kg' | 'litre' | 'pack';
            expiryDate: string | null;
            imageUrl: string | null;
            isActive: boolean;
          }> };
        }>('/products', { params: { is_active: 1, per_page: 2000 } });

        const serverProducts = productsRes.data.data?.data ?? [];

        // Map API response → LocalProduct schema
        const localProducts: LocalProduct[] = serverProducts.map((p) => ({
          uuid: p.uuid,
          shopId: parseInt(p.shopId, 10) || 0,
          categoryId: p.categoryId ? parseInt(p.categoryId, 10) : null,
          supplierId: p.supplierId ? parseInt(p.supplierId, 10) : null,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          buyingPrice: p.buyingPrice,
          sellingPrice: p.sellingPrice,
          quantity: p.quantity,
          reorderLevel: p.reorderLevel,
          unit: p.unit,
          expiryDate: p.expiryDate,
          imageUrl: p.imageUrl,
          isActive: p.isActive,
          syncedAt: new Date().toISOString(),
        }));

        // Bulk replace — full refresh, not delta
        await db.transaction('rw', db.products, async () => {
          await db.products.clear();
          await db.products.bulkAdd(localProducts);
        });

        // ── 2. Fetch categories ────────────────────────────────────────────────
        const catRes = await apiClient.get<{
          success: boolean;
          data: Array<{
            id: string;
            uuid: string;
            shopId: string;
            name: string;
            description: string | null;
            imageUrl: string | null;
          }>;
        }>('/categories');

        const serverCats = Array.isArray(catRes.data.data) ? catRes.data.data : [];

        const localCats: LocalCategory[] = serverCats.map((c) => ({
          uuid: c.uuid,
          shopId: parseInt(c.shopId, 10) || 0,
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl,
          syncedAt: new Date().toISOString(),
        }));

        await db.transaction('rw', db.categories, async () => {
          await db.categories.clear();
          await db.categories.bulkAdd(localCats);
        });

        // ── 3. Update sync timestamp ───────────────────────────────────────────
        setLastSyncedAt(new Date().toISOString());

        // Only toast on first load
        if (isFirstLoad) {
          toast.info(`Products updated (${localProducts.length} items)`, {
            description: 'POS is ready for offline use.',
            duration: 3000,
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Sync failed.';
        console.warn('[PosDataLoader] Failed to pre-load products:', message);
        // Don't toast — fail silently so POS remains usable
      }
    })();
  }, [lastSyncedAt, setLastSyncedAt]);

  return null;
}
