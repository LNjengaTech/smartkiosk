// src/lib/sync/sync-engine.ts
// Purpose: Singleton FIFO offline sync engine. Drains the Dexie queue by
//          POSTing batches to the backend when connectivity is restored.
//          Implements idempotency via operationUuid, retry with backoff, and
//          conflict logging.

'use client';

import { getDb } from '@/lib/db/dexie';
import apiClient from '@/lib/api/client';
import { useSyncStore } from '@/lib/stores/sync-store';
import type { SyncQueueEntry } from '@/types/db';

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNC_BATCH_SIZE = 10;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000; // 1 second base — doubles per retry

// ─── Singleton State ──────────────────────────────────────────────────────────

let _isSyncing = false;
let _syncTimeout: ReturnType<typeof setTimeout> | null = null;
const BATCH_WINDOW_MS =
  Number(process.env.NEXT_PUBLIC_SYNC_BATCH_WINDOW_MS) || 5_000;

// ─── Core Engine ─────────────────────────────────────────────────────────────

class SyncEngine {
  private static instance: SyncEngine;

  private constructor() {
    // Bind network event listeners in constructor
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onNetworkRestored());
      window.addEventListener('offline', () => this.onNetworkLost());
    }
  }

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  // ── Network Events ────────────────────────────────────────────────────────

  private onNetworkRestored(): void {
    const store = useSyncStore.getState();
    store.setOnline(true);
    console.info('[SyncEngine] Network restored — scheduling sync.');
    this.scheduleDrain();
  }

  private onNetworkLost(): void {
    const store = useSyncStore.getState();
    store.setOnline(false);
    console.info('[SyncEngine] Network lost — sync paused.');
    if (_syncTimeout) {
      clearTimeout(_syncTimeout);
      _syncTimeout = null;
    }
  }

  // ── Queue Management ──────────────────────────────────────────────────────

  /**
   * Enqueue an operation into the Dexie sync queue.
   * Returns the assigned Dexie record ID.
   */
  async enqueue(
    resource: string,
    operation: SyncQueueEntry['operation'],
    payload: unknown,
  ): Promise<number> {
    const db = getDb();
    const { nanoid } = await import('nanoid');

    const entry: SyncQueueEntry = {
      operationUuid: nanoid(),
      resource,
      operation,
      payload,
      status: 'pending',
      retries: 0,
      createdAt: new Date().toISOString(),
      lastAttemptAt: null,
      error: null,
    };

    const id = await db.syncQueue.add(entry);
    useSyncStore.getState().incrementPending();

    // Schedule drain with debounce window
    this.scheduleDrain();
    return id as number;
  }

  /**
   * Schedule a drain cycle with a debounce window.
   * Prevents hammering the server with too-frequent sync calls.
   */
  scheduleDrain(): void {
    if (!navigator.onLine || _isSyncing) return;

    if (_syncTimeout) {
      clearTimeout(_syncTimeout);
    }
    _syncTimeout = setTimeout(() => {
      void this.drain();
    }, BATCH_WINDOW_MS);
  }

  // ── Drain Cycle ───────────────────────────────────────────────────────────

  /**
   * Main drain loop — processes pending queue entries FIFO in batches.
   */
  async drain(): Promise<void> {
    if (_isSyncing || !navigator.onLine) return;

    _isSyncing = true;
    const store = useSyncStore.getState();
    store.setEngineStatus('syncing');

    const db = getDb();

    try {
      // Fetch next batch of pending entries (FIFO order)
      const pending = await db.syncQueue
        .where('status')
        .equals('pending')
        .limit(SYNC_BATCH_SIZE)
        .sortBy('createdAt');

      if (pending.length === 0) {
        store.setEngineStatus('idle');
        store.setLastSyncedAt(new Date().toISOString());
        return;
      }

      // Mark batch as processing
      const ids = pending.map((e) => e.id!);
      await db.syncQueue
        .where('id')
        .anyOf(ids)
        .modify({ status: 'processing', lastAttemptAt: new Date().toISOString() });

      // Submit batch to backend
      const results = await this.submitBatch(pending);

      // Process individual results
      for (let i = 0; i < pending.length; i++) {
        const entry = pending[i];
        const result = results[i];

        if (result.success) {
          await db.syncQueue.delete(entry.id!);
          store.decrementPending();
        } else {
          const retries = (entry.retries ?? 0) + 1;
          if (retries >= MAX_RETRIES) {
            await db.syncQueue.update(entry.id!, {
              status: 'failed',
              retries,
              error: result.error ?? 'Max retries exceeded.',
            });
            store.decrementPending();
          } else {
            // Exponential backoff: retry after 2^retries seconds
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retries);
            await db.syncQueue.update(entry.id!, {
              status: 'pending',
              retries,
              error: result.error,
            });
            setTimeout(() => this.scheduleDrain(), delay);
          }
        }
      }

      store.setLastSyncedAt(new Date().toISOString());
      store.setEngineStatus('idle');

      // If there are more pending entries, schedule next drain cycle
      const remaining = await db.syncQueue
        .where('status')
        .equals('pending')
        .count();
      if (remaining > 0) {
        this.scheduleDrain();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sync failed.';
      store.setEngineStatus('error');
      store.setLastError(message);
      console.error('[SyncEngine] Drain error:', message);
    } finally {
      _isSyncing = false;
    }
  }

  // ── Batch Submission ──────────────────────────────────────────────────────

  /**
   * POSTs a batch of sync entries to the backend idempotency endpoint.
   * Returns an array of per-entry results.
   */
  private async submitBatch(
    entries: SyncQueueEntry[],
  ): Promise<Array<{ success: boolean; error?: string }>> {
    try {
      const batchPayload = entries.map((entry) => {
        const payloadObj = entry.payload as Record<string, unknown> | null;
        return {
          operationUuid: entry.operationUuid,
          operationType: entry.operation,
          resourceType: entry.resource,
          resourceUuid: payloadObj?.uuid || null,
          payload: entry.payload,
          occurredAt: payloadObj?.expenseDate || payloadObj?.soldAt || entry.createdAt,
        };
      });

      const response = await apiClient.post<{
        success: boolean;
        results: Array<{ operationUuid: string; status: string; message?: string }>;
      }>('/sync/batch', { operations: batchPayload });

      // Map results back to original entry order
      const resultMap = new Map(
        response.data.results.map((r) => [r.operationUuid, r]),
      );

      return entries.map((entry) => {
        const result = resultMap.get(entry.operationUuid);
        if (result && (result.status === 'synced' || result.status === 'conflict')) {
          return { success: true };
        }
        return { success: false, error: result?.message || 'No result returned for operation.' };
      });
    } catch (error: unknown) {
      // If the whole batch fails, mark all as failed
      const message = error instanceof Error ? error.message : 'Batch submission failed.';
      return entries.map(() => ({ success: false, error: message }));
    }
  }

  // ── Queue Stats ───────────────────────────────────────────────────────────

  /**
   * Returns the current number of pending items in the sync queue.
   */
  async getPendingCount(): Promise<number> {
    const db = getDb();
    return db.syncQueue.where('status').equals('pending').count();
  }

  /**
   * Returns the number of permanently failed items in the sync queue.
   */
  async getFailedCount(): Promise<number> {
    const db = getDb();
    return db.syncQueue.where('status').equals('failed').count();
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const syncEngine = SyncEngine.getInstance();
