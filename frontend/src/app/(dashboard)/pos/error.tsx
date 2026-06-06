'use client';

// src/app/(dashboard)/pos/error.tsx
// Purpose: Error boundary for the POS page — shows a recovery UI without crashing the session.

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface PosErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PosError({ error, reset }: PosErrorProps) {
  useEffect(() => {
    console.error('[POS] Page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold">POS failed to load</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.message || 'An unexpected error occurred. The cart is preserved in IndexedDB.'}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">Error ID: {error.digest}</p>
      )}
      <Button onClick={reset} className="gap-2 mt-2">
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
