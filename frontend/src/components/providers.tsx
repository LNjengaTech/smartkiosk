// src/components/providers.tsx
// Purpose: Client-side provider wrapper. Hydrates Zustand auth store,
//          mounts React Query client, and renders Sonner toast notifications.

'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/lib/stores/auth-store';

// ─── React Query Client ───────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry 4xx errors — only network failures
        if (typeof error === 'object' && error !== null && 'success' in error) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// ─── Hydration Component ──────────────────────────────────────────────────────

function StoreHydration() {
  useEffect(() => {
    // Hydrate Zustand persist store on client mount
    // skipHydration was set to prevent SSR mismatch
    useAuthStore.persist.rehydrate();
  }, []);

  return null;
}

// ─── Providers ────────────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <StoreHydration />
      {children}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
          classNames: {
            toast:
              'font-sans text-sm rounded-xl shadow-lg border border-border/50',
          },
        }}
      />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
