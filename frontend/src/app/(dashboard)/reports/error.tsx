'use client';

// frontend/src/app/(dashboard)/reports/error.tsx
// Purpose: Error boundary for reports page.

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ReportsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ReportsError({ error, reset }: ReportsErrorProps) {
  useEffect(() => {
    toast.error('Reports failed to load', {
      description: error.message ?? 'An unexpected error occurred.',
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] gap-5 text-center">
      <div className="rounded-full bg-destructive/10 p-5">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <h2 className="text-xl font-semibold">Reports unavailable</h2>
        <p className="text-sm text-muted-foreground">
          We could not fetch your business intelligence and report analytics. Please check your network connection and try again.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono mt-2">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </div>
  );
}
