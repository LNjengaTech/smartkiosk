// frontend/app/(dashboard)/products/categories/loading.tsx
// Purpose: Skeleton loader matching the shape of the categories list page.

import { Skeleton } from '@/components/ui/skeleton';

export default function CategoriesLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/40 border-b border-border">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20 ml-auto" />
        </div>

        {/* Data rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0"
          >
            <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-4 w-8" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
