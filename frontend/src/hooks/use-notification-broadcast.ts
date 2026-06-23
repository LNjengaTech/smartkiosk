'use client';

// src/hooks/use-notification-broadcast.ts
// Purpose: Subscribes to the authenticated user's private Pusher notification channel (private-user.{userId})
//          and invalidates the notifications query whenever a new real-time notification is broadcasted.

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';

export function useNotificationBroadcast() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof import('pusher-js')['default']['prototype']['subscribe']> | null>(null);
  const pusherRef = useRef<InstanceType<typeof import('pusher-js')['default']> | null>(null);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    const pusherHost = process.env.NEXT_PUBLIC_PUSHER_HOST;
    const pusherPort = process.env.NEXT_PUBLIC_PUSHER_PORT;
    const pusherScheme = process.env.NEXT_PUBLIC_PUSHER_SCHEME || 'http';

    if (!pusherKey) {
      console.warn('[Pusher] NEXT_PUBLIC_PUSHER_KEY is not configured.');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const Pusher = (await import('pusher-js')).default;
        if (cancelled) return;

        // Resolve token for authorization
        const token = window.localStorage.getItem('smartkiosk_token');

        // Dynamically resolve backend base URL for broadcasting auth
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api/v1';
        const hostUrl = apiBaseUrl.replace('/api/v1', '');
        const authEndpoint = `${hostUrl}/broadcasting/auth`;

        // Build options object — cluster is required by pusher-js TS types but
        // may be empty string when using Reverb as the local WS server.
        const options = {
          cluster: pusherCluster ?? 'mt1',
          authEndpoint,
          auth: {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          },
          ...(pusherHost
            ? {
                wsHost: pusherHost,
                wsPort: pusherPort ? Number(pusherPort) : 80,
                wssPort: pusherPort ? Number(pusherPort) : 443,
                forceTLS: pusherScheme === 'https',
                disableStats: true,
                enabledTransports: ['ws', 'wss'] as ('ws' | 'wss')[],
              }
            : {}),
        };

        const pusher = new Pusher(pusherKey, options);
        pusherRef.current = pusher;

        const channelName = `private-user.${user.id}`;
        const channel = pusher.subscribe(channelName);
        channelRef.current = channel;

        channel.bind('Illuminate\\Notifications\\Events\\BroadcastNotificationCreated', () => {
          if (cancelled) return;
          // Invalidate the query key to refresh list
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        });

        channel.bind('pusher:subscription_error', (err: Record<string, unknown>) => {
          console.warn('[Pusher] Subscription error:', err);
        });

      } catch (err: unknown) {
        console.warn('[Pusher] Connection error:', err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      if (channelRef.current && pusherRef.current) {
        pusherRef.current.unsubscribe(`private-user.${user.id}`);
        channelRef.current = null;
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, [user?.id, queryClient]);
}
