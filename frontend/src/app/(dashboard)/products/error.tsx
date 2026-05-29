// frontend/app/(dashboard)/products/error.tsx
// Purpose: Error boundary retry placeholder for the products catalogue page.

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Products catalog page boundary error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 animate-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Failed to load products
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'An unexpected error occurred while fetching the product catalogue.'}
        </p>
      </div>
      <Button onClick={() => reset()} variant="outline">
        Try Again
      </Button>
    </div>
  );
}
