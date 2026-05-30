// frontend/src/app/(dashboard)/stock/loading.tsx
// Purpose: Skeleton for the stock management page.

import { Skeleton } from '@/components/ui/skeleton';

export default function StockLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 rounded-2xl border border-border bg-card">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/40 border-b border-border">
          {[40, 60, 32, 28, 36, 40].map((w, i) => (
            <Skeleton key={i} className={`h-4 w-${w}`} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
