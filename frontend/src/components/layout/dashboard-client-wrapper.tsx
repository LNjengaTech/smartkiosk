'use client';

// src/components/layout/dashboard-client-wrapper.tsx
// Purpose: Client wrapper for the dashboard layout. Mounts the real-time notification broadcast listener.

import { useNotificationBroadcast } from '@/hooks/use-notification-broadcast';

export function DashboardClientWrapper() {
  useNotificationBroadcast();
  return null;
}
