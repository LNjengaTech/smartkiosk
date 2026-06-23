'use client';

// src/app/(dashboard)/settings/notifications/page.tsx
// Purpose: Shop owners' notification preference toggler. Allows toggling email & sms channels
//          for Low Stock, Expiry Alert, Daily Summary, Sale Voided, and Sync Failed notification types.
//          In-App notification channel is locked to active.

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Mail, MessageSquare, Loader2, Save, ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { useAuthStore } from '@/lib/stores/auth-store';
import apiClient from '@/lib/api/client';
import type { NotificationPreferences, NotificationChannel } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

const NOTIFICATION_TYPES = [
  {
    key: 'low_stock',
    title: 'Low Stock Alert',
    description: 'Triggered when inventory level falls below the threshold/reorder point.',
  },
  {
    key: 'expiry_alert',
    title: 'Expiry Alert',
    description: 'Triggered when a product batch is nearing its expiration date (within 30 days).',
  },
  {
    key: 'daily_summary',
    title: 'Daily Business Summary',
    description: 'A daily financial and operational report delivered at the close of business.',
  },
  {
    key: 'sale_voided',
    title: 'Sale Voided',
    description: 'Immediate alert when a transaction is voided by an cashier or manager.',
  },
  {
    key: 'sync_failed',
    title: 'Sync Engine Stalled',
    description: 'Urgent notification if local client synchronization stalls for over an hour.',
  },
] as const;

type PrefsState = Record<string, Record<NotificationChannel, boolean>>;

export default function NotificationSettingsPage() {
  const { hasRole, _hasHydrated } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [localPrefs, setLocalPrefs] = useState<PrefsState | null>(null);

  // ─── Fetch Settings ────────────────────────────────────────────────────────
  const { data: preferences, isLoading, error } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: NotificationPreferences }>('/shops/notification-preferences');
      return res.data.data;
    },
    enabled: _hasHydrated && hasRole('owner'),
  });

  // Hydrate local state when query completes
  useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences as unknown as PrefsState);
    }
  }, [preferences]);

  // ─── Save Changes Mutation ──────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async (updated: PrefsState) => {
      const res = await apiClient.patch<{ success: boolean; data: NotificationPreferences }>('/shops/notification-preferences', updated);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['notification-preferences'], data);
      toast.success('Notification preferences saved successfully');
    },
    onError: (err: Error & { message?: string }) => {
      toast.error(err?.message || 'Failed to update preferences');
    },
  });

  // ─── Guard Access ──────────────────────────────────────────────────────────
  if (!_hasHydrated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasRole('owner')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 border border-dashed rounded-2xl bg-muted/20">
        <ShieldAlert className="h-10 w-10 text-destructive mb-3" />
        <h2 className="text-lg font-bold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Only shop owners have permissions to manage store-wide notification channel settings.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const handleToggle = (typeKey: string, channel: NotificationChannel, checked: boolean) => {
    if (!localPrefs) return;
    setLocalPrefs({
      ...localPrefs,
      [typeKey]: {
        ...localPrefs[typeKey],
        [channel]: checked,
      },
    });
  };

  const handleSave = () => {
    if (!localPrefs) return;
    mutation.mutate(localPrefs);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      {/* Header breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="h-8 rounded-lg -ml-2 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Dashboard
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">Notification Settings</h1>
        <p className="text-muted-foreground">
          Configure how and where you receive shop-wide notifications and alerts.
        </p>
      </div>

      <Separator className="border-border/30" />

      {isLoading || !localPrefs ? (
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Loading store preferences...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5 text-destructive">
          <CardContent className="py-8 text-center text-sm font-medium">
            Failed to retrieve preferences. Please refresh the page.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30">
              <CardTitle className="text-base font-semibold">Store-Wide Broadcast Settings</CardTitle>
              <CardDescription>
                Define channels for each alert type. In-App delivery is mandatory for audit compliance.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 divide-y divide-border/30">
              {NOTIFICATION_TYPES.map((type) => {
                const prefs = localPrefs[type.key] || { in_app: true, email: false, sms: false };
                return (
                  <div key={type.key} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-muted/10 transition-colors duration-200">
                    <div className="space-y-1 max-w-lg">
                      <h3 className="font-semibold text-sm text-foreground">{type.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{type.description}</p>
                    </div>

                    {/* Channels toggler */}
                    <div className="flex items-center gap-6 self-start md:self-center">
                      {/* In-App Switch */}
                      <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <Bell className="h-3 w-3" /> In-App
                        </span>
                        <Switch
                          checked={prefs.in_app}
                          disabled={true}
                          aria-label={`In-app channel for ${type.title}`}
                        />
                      </div>

                      {/* Email Switch */}
                      <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <Mail className="h-3 w-3" /> Email
                        </span>
                        <Switch
                          checked={prefs.email}
                          onCheckedChange={(checked) => handleToggle(type.key, 'email', checked)}
                          aria-label={`Email channel for ${type.title}`}
                        />
                      </div>

                      {/* SMS Switch */}
                      <div className="flex flex-col items-center gap-1.5 min-w-[70px]">
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> SMS
                        </span>
                        <Switch
                          checked={prefs.sms}
                          onCheckedChange={(checked) => handleToggle(type.key, 'sms', checked)}
                          aria-label={`SMS channel for ${type.title}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>

            <CardFooter className="flex items-center justify-between p-6 bg-muted/20 border-t border-border/40">
              <span className="text-xs text-muted-foreground">
                Last updated automatically upon saving.
              </span>
              <Button
                onClick={handleSave}
                disabled={mutation.isPending}
                className="rounded-xl px-5 h-10 shadow-sm"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
