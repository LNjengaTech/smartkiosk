// src/lib/stores/sync-store.ts
// Purpose: Zustand sync state store — tracks online status, sync queue depth, and engine state.

import { create } from 'zustand';

// ─── State Interface ──────────────────────────────────────────────────────────

export type SyncEngineStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncState {
  isOnline: boolean;
  engineStatus: SyncEngineStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;

  // Actions
  setOnline: (status: boolean) => void;
  setEngineStatus: (status: SyncEngineStatus) => void;
  setPendingCount: (count: number) => void;
  setLastSyncedAt: (timestamp: string) => void;
  setLastError: (error: string | null) => void;
  incrementPending: () => void;
  decrementPending: () => void;
}

// ─── Store Definition ─────────────────────────────────────────────────────────

export const useSyncStore = create<SyncState>()((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  engineStatus: 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,

  setOnline: (status) =>
    set({
      isOnline: status,
      engineStatus: status ? 'idle' : 'offline',
    }),

  setEngineStatus: (status) => set({ engineStatus: status }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setLastSyncedAt: (timestamp) => set({ lastSyncedAt: timestamp }),
  setLastError: (error) => set({ lastError: error }),

  incrementPending: () =>
    set((state) => ({ pendingCount: state.pendingCount + 1 })),

  decrementPending: () =>
    set((state) => ({
      pendingCount: Math.max(0, state.pendingCount - 1),
    })),
}));
