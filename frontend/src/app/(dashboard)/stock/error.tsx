// frontend/src/app/(dashboard)/stock/error.tsx
// Purpose: Error boundary for the stock management page.

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StockError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Stock page boundary error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 animate-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-xl font-semibold tracking-tight">
          Failed to load stock management
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">Try Again</Button>
    </div>
  );
}
