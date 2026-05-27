// src/hooks/use-sync-status.ts
// Purpose: Hook returning the current sync engine status and pending queue count.

'use client';

import { useSyncStore, type SyncEngineStatus } from '@/lib/stores/sync-store';

interface SyncStatus {
  isOnline: boolean;
  engineStatus: SyncEngineStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  isSyncing: boolean;
}

export function useSyncStatus(): SyncStatus {
  const { isOnline, engineStatus, pendingCount, lastSyncedAt, lastError } =
    useSyncStore();

  return {
    isOnline,
    engineStatus,
    pendingCount,
    lastSyncedAt,
    lastError,
    isSyncing: engineStatus === 'syncing',
  };
}
