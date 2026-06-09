'use client';

// src/hooks/use-pusher-sale-notifications.ts
// Purpose: Subscribe to the private-shop.{shopId} Pusher channel and handle
//          real-time sale.created events — shows a Sonner toast to other
//          connected cashiers when a sale is completed.

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';

// ─── Type for the broadcasted sale payload ────────────────────────────────────

interface BroadcastedSale {
  receiptNumber: string;
  totalAmount: number;
  paymentMethod: string;
  itemCount?: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePusherSaleNotifications() {
  const { shop } = useAuthStore();
  const channelRef = useRef<ReturnType<typeof import('pusher-js')['default']['prototype']['subscribe']> | null>(null);
  const pusherRef = useRef<InstanceType<typeof import('pusher-js')['default']> | null>(null);

  useEffect(() => {
    if (!shop?.uuid || typeof window === 'undefined') return;

    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.warn('[Pusher] NEXT_PUBLIC_PUSHER_KEY or NEXT_PUBLIC_PUSHER_CLUSTER not configured.');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const Pusher = (await import('pusher-js')).default;

        if (cancelled) return;

        const pusher = new Pusher(pusherKey, {
          cluster: pusherCluster,
          authEndpoint: '/api/broadcasting/auth',
          // Auth headers are handled by the Axios interceptor via cookies
        });

        pusherRef.current = pusher;

        // Subscribe to this shop's private channel
        const channel = pusher.subscribe(`private-shop.${shop.uuid}`);
        channelRef.current = channel;

        channel.bind('sale.created', (data: BroadcastedSale) => {
          if (!data) return;
          toast.info('New sale recorded', {
            description: `${data.receiptNumber} — KES ${Number(data.totalAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })} via ${data.paymentMethod}`,
            duration: 5000,
          });
        });

        channel.bind('pusher:subscription_error', (err: unknown) => {
          console.warn('[Pusher] Subscription error:', err);
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Pusher init failed';
        console.warn('[Pusher] Init error:', message);
      }
    })();

    return () => {
      cancelled = true;
      if (channelRef.current && pusherRef.current) {
        pusherRef.current.unsubscribe(`private-shop.${shop.uuid}`);
        channelRef.current = null;
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
    };
  }, [shop?.uuid]);
}
