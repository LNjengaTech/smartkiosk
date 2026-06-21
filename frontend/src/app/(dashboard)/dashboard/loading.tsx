// frontend/src/app/(dashboard)/dashboard/loading.tsx
// Purpose: Skeleton loading state for the dashboard page — mirrors full layout
//          to prevent layout shift on data hydration.

import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-5 w-80" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid skeleton */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-7">
        {/* Area chart skeleton */}
        <div className="lg:col-span-4 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-6 space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="w-full h-[300px] rounded-xl" />
        </div>

        {/* Recent transactions skeleton */}
        <div className="lg:col-span-3 rounded-2xl border bg-card shadow-sm">
          <div className="px-6 pt-6 pb-3 border-b space-y-1.5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Top products chart skeleton */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 space-y-1.5">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-36" />
          </div>
          <Skeleton className="w-full h-[200px] rounded-xl" />
        </div>

        {/* Low stock alerts skeleton */}
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="px-6 pt-6 pb-3 border-b space-y-1.5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="p-4 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 pl-3 border-l-2 border-muted">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
