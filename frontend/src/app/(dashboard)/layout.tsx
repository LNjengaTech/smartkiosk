// src/app/(dashboard)/layout.tsx
// Purpose: Main dashboard shell layout with sidebar and sync status widget.

import type { Metadata } from 'next';
import { Sidebar } from '@/components/layout/sidebar';
import { SyncStatus } from '@/components/shared/sync-status';
import { OfflineIndicator } from '@/components/shared/offline-indicator';
import { DashboardClientWrapper } from '@/components/layout/dashboard-client-wrapper';
import { NotificationBell } from '@/components/shared/notification-bell';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'SmartKiosk retail management dashboard',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Real-time Broadcaster Listener */}
      <DashboardClientWrapper />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-border/30 bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex-1" />
          <NotificationBell />
          <SyncStatus />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Global Offline/Syncing Indicator */}
      <OfflineIndicator />
    </div>
  );
}
