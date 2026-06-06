// src/app/(dashboard)/pos/loading.tsx
// Purpose: Skeleton loading state for the POS page split-pane layout.

import { Skeleton } from '@/components/ui/skeleton';

export default function PosLoading() {
  return (
    <div className="hidden md:grid h-[calc(100vh-4rem)] grid-cols-[1fr_400px]">
      {/* Left panel skeleton */}
      <div className="border-r p-4 space-y-4">
        {/* Search bar skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
        {/* Product grid skeleton */}
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      {/* Right cart panel skeleton */}
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-full mt-auto" />
      </div>
    </div>
  );
}
