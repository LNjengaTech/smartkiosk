'use client';

// src/components/shared/notification-bell.tsx
// Purpose: Interactive notification bell component featuring real-time unread badges,
//          a high-fidelity popover with styled list items for each notification type,
//          and actions (mark as read, delete, mark all read).

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Package,
  Calendar,
  TrendingUp,
  ShieldAlert,
  WifiOff,
  Check,
  Trash2,
  Loader2,
  Inbox,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api/client';
import type { AppNotification, NotificationsListResponse } from '@/types/api';
import { formatRelativeTime, cn, formatCurrency } from '@/lib/utils';

// ─── Resolve Notification Styles & Icons ─────────────────────────────────────
const getNotificationConfig = (type: string) => {
  switch (type) {
    case 'low_stock':
      return {
        icon: Package,
        colorClass: 'bg-red-50 text-red-600 border-red-100/50 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30',
      };
    case 'expiry_alert':
      return {
        icon: Calendar,
        colorClass: 'bg-amber-50 text-amber-600 border-amber-100/50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30',
      };
    case 'daily_summary':
      return {
        icon: TrendingUp,
        colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-100/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30',
      };
    case 'sale_voided':
      return {
        icon: ShieldAlert,
        colorClass: 'bg-rose-50 text-rose-600 border-rose-100/50 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30',
      };
    case 'sync_failed':
      return {
        icon: WifiOff,
        colorClass: 'bg-purple-50 text-purple-600 border-purple-100/50 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900/30',
      };
    default:
      return {
        icon: Bell,
        colorClass: 'bg-primary/10 text-primary border-primary/20',
      };
  }
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // ─── Fetch Notifications ───────────────────────────────────────────────────
  const { data, isLoading } = useQuery<NotificationsListResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: NotificationsListResponse }>('/notifications');
      return res.data.data;
    },
    refetchInterval: 30000, // Backup polling every 30s
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notifications/read-all');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
    onError: (err: Error & { message?: string }) => {
      toast.error(err?.message || 'Failed to mark all as read');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notifications/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error & { message?: string }) => {
      toast.error(err?.message || 'Failed to delete notification');
    },
  });

  // ─── Render Rich Custom Payload Detail ─────────────────────────────────────
  const renderNotificationPayload = (notification: AppNotification) => {
    const payload = notification.data || {};
    switch (notification.type) {
      case 'low_stock':
        return (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Product <span className="font-semibold text-foreground">{payload.product_name || 'N/A'}</span> has{' '}
            <span className="text-red-500 font-bold">{payload.stock_count ?? 0}</span> units left (min reorder level: {payload.reorder_level ?? 0}).
          </p>
        );
      case 'expiry_alert':
        return (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Product <span className="font-semibold text-foreground">{payload.product_name || 'N/A'}</span> expires on{' '}
            <span className="text-amber-500 font-bold">{payload.expiry_date ? new Date(payload.expiry_date as string).toLocaleDateString() : 'N/A'}</span> ({payload.days_left ?? 0} days remaining).
          </p>
        );
      case 'daily_summary':
        return (
          <div className="mt-1.5 p-2 bg-muted/40 rounded-lg border border-border/20 text-xs text-muted-foreground space-y-0.5">
            <div>Total Sales: <span className="font-semibold text-foreground">{formatCurrency(Number(payload.total_sales ?? 0))}</span></div>
            <div>Total Profit: <span className="font-semibold text-foreground">{formatCurrency(Number(payload.total_profit ?? 0))}</span></div>
            <div>Tx Count: <span className="font-semibold text-foreground">{payload.transaction_count ?? 0}</span></div>
          </div>
        );
      case 'sale_voided':
        return (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Receipt <span className="font-semibold text-foreground font-mono">{payload.receipt_number || 'N/A'}</span> for{' '}
            <span className="font-bold text-foreground">{formatCurrency(Number(payload.total_amount ?? 0))}</span> was voided by{' '}
            <span className="font-semibold text-foreground">{payload.voided_by || 'Staff'}</span>.
          </p>
        );
      case 'sync_failed':
        return (
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Sync failed for device <span className="font-mono text-foreground">{String(payload.device_id || 'N/A').slice(0, 8)}</span>. Stalled for{' '}
            <span className="text-purple-500 font-semibold">{payload.stall_duration || 'unknown duration'}</span>.
          </p>
        );
      default:
        return <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{notification.message}</p>;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 rounded-xl hover:bg-muted/50 border-border/50"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground border-2 border-background flex items-center justify-center animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-96 rounded-2xl p-0 bg-background/95 backdrop-blur-xl border border-border/40 shadow-2xl flex flex-col max-h-[500px]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <div>
            <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
              className="text-xs text-primary hover:text-primary/80 hover:bg-primary/5 px-2.5 h-8 rounded-lg font-medium"
            >
              {markAllReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* List Content */}
        <ScrollArea className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin mr-2 text-primary" />
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted/30 border border-border/10 flex items-center justify-center text-muted-foreground/60 mb-3">
                <Inbox className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                No recent notifications or stock alerts to report.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map((notification) => {
                const config = getNotificationConfig(notification.type);
                const Icon = config.icon;
                const isUnread = !notification.readAt;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "group relative p-4 flex gap-3.5 transition-colors duration-200 hover:bg-muted/30",
                      isUnread && "bg-primary/[0.02]"
                    )}
                  >
                    {/* Unread Indicator Bar */}
                    {isUnread && (
                      <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-md" />
                    )}

                    {/* Icon circle */}
                    <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-border/20", config.colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {notification.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>

                      {renderNotificationPayload(notification)}
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute right-3 top-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {isUnread && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5"
                          title="Mark read"
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate(notification.id);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                        title="Delete notification"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(notification.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
