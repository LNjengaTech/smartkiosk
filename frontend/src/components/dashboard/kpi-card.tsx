// frontend/src/components/dashboard/kpi-card.tsx
// Purpose: Reusable KPI metric card with premium design, trend indicators, and loading skeleton states.

import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface KpiCardProps {
  label: string
  value: string
  subLabel?: string
  trend?: {
    value: number // percentage, e.g. 18 or -5
    label: string // e.g. "vs yesterday"
  }
  icon?: LucideIcon
  isLoading?: boolean
}

export function KpiCard({
  label,
  value,
  subLabel,
  trend,
  icon: Icon,
  isLoading = false,
}: KpiCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-[120px]" />
          <Skeleton className="h-4 w-[180px]" />
        </div>
      </div>
    )
  }

  const isPositive = trend && trend.value > 0
  const isNegative = trend && trend.value < 0
  const isZero = trend && trend.value === 0

  return (
    <div className="group rounded-2xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {label}
        </span>
        {Icon && (
          <div className="rounded-xl bg-muted p-2 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center text-xs font-semibold rounded-full px-2 py-0.5",
                isPositive && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
                isNegative && "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
                isZero && "bg-muted text-muted-foreground"
              )}
            >
              {isPositive && "+"}
              {trend.value}%
            </span>
          )}
          {subLabel && (
            <span className="text-xs text-muted-foreground">
              {subLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
