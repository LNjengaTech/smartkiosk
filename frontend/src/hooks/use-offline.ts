// src/hooks/use-offline.ts
// Purpose: React hook that tracks browser online/offline status
//          and updates the Zustand sync store accordingly.

'use client';

import { useEffect } from 'react';
import { useSyncStore } from '@/lib/stores/sync-store';

export function useOffline(): boolean {
  const { isOnline, setOnline } = useSyncStore();

  useEffect(() => {
    // Sync initial state in case it drifted during SSR
    setOnline(navigator.onLine);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return !isOnline;
}
