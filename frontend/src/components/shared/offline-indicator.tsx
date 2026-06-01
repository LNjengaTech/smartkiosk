// src/components/shared/offline-indicator.tsx
// Purpose: Floating pill indicator showing online/offline/syncing status
//          with animated transitions and pending queue count badge.

'use client';

import { useOffline } from '@/hooks/use-offline';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export function OfflineIndicator() {
  const isOffline = useOffline();
  const { engineStatus, pendingCount, isSyncing } = useSyncStatus();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine display state
  const state = isOffline
    ? 'offline'
    : isSyncing
      ? 'syncing'
      : engineStatus === 'error'
        ? 'error'
        : pendingCount > 0
          ? 'pending'
          : 'online';

  const config = {
    online: {
      label: 'Online',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      className: 'status-online',
      show: false, // Hidden when fully online with nothing pending
    },
    offline: {
      label: 'Offline',
      icon: <WifiOff className="h-3.5 w-3.5" />,
      className: 'status-offline',
      show: true,
    },
    syncing: {
      label: `Syncing${pendingCount > 0 ? ` (${pendingCount})` : ''}…`,
      icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
      className: 'status-syncing',
      show: true,
    },
    pending: {
      label: `${pendingCount} pending`,
      icon: <Wifi className="h-3.5 w-3.5" />,
      className: 'status-syncing',
      show: true,
    },
    error: {
      label: 'Sync error',
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      className: 'status-error',
      show: true,
    },
  } as const;

  const current = config[state];
  if (!mounted || !current.show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Network status: ${current.label}`}
      className={cn(
        'fixed bottom-4 left-4 z-50 animate-slide-up',
        'transition-all duration-300 ease-out',
      )}
    >
      <span className={cn(current.className, 'shadow-md')}>
        {current.icon}
        <span>{current.label}</span>
      </span>
    </div>
  );
}
