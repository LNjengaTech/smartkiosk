// frontend/app/(dashboard)/products/error.tsx
// Purpose: Error boundary retry placeholder for the products catalogue page.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductsError({ error, reset }: ErrorProps) {
  const router = useRouter();

  useEffect(() => {
    console.error('[Products] Error boundary triggered:', error);
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
        {process.env.NODE_ENV === 'development' && error.stack && (
          <pre className="mt-2 text-left text-xs text-destructive/80 bg-destructive/5 p-3 rounded-lg overflow-auto max-h-32 border border-destructive/20">
            {error.stack}
          </pre>
        )}
      </div>
      <div className="flex gap-3">
        <Button onClick={() => reset()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" /> Try Again
        </Button>
        <Button onClick={() => router.push('/dashboard')} variant="ghost">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
