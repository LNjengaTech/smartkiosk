// frontend/src/app/(dashboard)/expenses/error.tsx
// Purpose: Elegant fallback error boundary for runtime page rendering failures.

'use client';

import { useEffect } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExpensesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Expenses Page Error Boundary]:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-card border border-border rounded-2xl shadow-xs">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertOctagon className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-bold tracking-tight text-foreground">Something went wrong!</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mb-6">
        {error.message || 'An unexpected error occurred while loading the expenses ledger.'}
      </p>
      <Button onClick={() => reset()} className="shadow-sm">
        <RotateCcw className="mr-2 h-4 w-4" /> Try Again
      </Button>
    </div>
  );
}
