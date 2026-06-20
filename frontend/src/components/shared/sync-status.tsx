// src/components/shared/sync-status.tsx
// Purpose: Compact sync status widget for placement in the dashboard header/sidebar.
//          Shows queue depth, last sync time, and engine state with tooltip.

'use client';

import { useSyncStatus } from '@/hooks/use-sync-status';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { RefreshCw, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';

interface SyncStatusProps {
  className?: string;
  compact?: boolean;
}

export function SyncStatus({ className, compact = false }: SyncStatusProps) {
  const { engineStatus, pendingCount, lastSyncedAt, lastError } =
    useSyncStatus();

  const iconMap = {
    idle: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    syncing: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
    error: <AlertCircle className="h-4 w-4 text-red-500" />,
    offline: <WifiOff className="h-4 w-4 text-amber-500" />,
  };

  const labelMap = {
    idle: lastSyncedAt ? `Synced ${formatRelativeTime(lastSyncedAt)}` : 'Up to date',
    syncing: `Syncing ${pendingCount > 0 ? `(${pendingCount})` : ''}…`,
    error: lastError ?? 'Sync error',
    offline: 'Offline mode',
  };

  const icon = iconMap[engineStatus];
  const label = labelMap[engineStatus];

  if (compact) {
    return (
      <div
        title={label}
        aria-label={label}
        className={cn('flex items-center justify-center', className)}
      >
        {icon}
        {pendingCount > 0 && (
          <span className="ml-1 text-xs font-semibold text-blue-500">
            {pendingCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-1.5',
        'bg-muted/50 border border-border/50',
        'text-sm text-muted-foreground',
        className,
      )}
      aria-live="polite"
      aria-label={`Sync status: ${label}`}
    >
      {icon}
      <span className="truncate max-w-[140px]">{label}</span>
      {pendingCount > 0 && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white">
          {pendingCount}
        </span>
      )}
    </div>
  );
}
