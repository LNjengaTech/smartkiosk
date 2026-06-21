// frontend/src/components/reports/date-range-picker.tsx
// Purpose: A reusable date range selector that synchronizes its state directly
//          with the URL query parameters (?from=...&to=...) to ensure shareability.

'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get current values from URL or fallback to default range (last 30 days)
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const defaultFrom = format(subDays(new Date(), 29), 'yyyy-MM-dd');
  const defaultTo = format(new Date(), 'yyyy-MM-dd');

  const fromValue = fromParam || defaultFrom;
  const toValue = toParam || defaultTo;

  // Update query params in URL
  const updateRange = React.useCallback(
    (newFrom: string, newTo: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('from', newFrom);
      params.set('to', newTo);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateRange(e.target.value, toValue);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateRange(fromValue, e.target.value);
  };

  // Shortcut range helpers
  const applyShortcut = (type: 'today' | 'this-week' | 'this-month' | 'last-month' | 'last-3-months') => {
    const today = new Date();
    let newFrom = today;
    let newTo = today;

    switch (type) {
      case 'today':
        newFrom = today;
        newTo = today;
        break;
      case 'this-week':
        newFrom = startOfWeek(today, { weekStartsOn: 1 });
        newTo = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'this-month':
        newFrom = startOfMonth(today);
        newTo = endOfMonth(today);
        break;
      case 'last-month': {
        const lastMonth = subMonths(today, 1);
        newFrom = startOfMonth(lastMonth);
        newTo = endOfMonth(lastMonth);
        break;
      }
      case 'last-3-months':
        newFrom = subMonths(today, 3);
        newTo = today;
        break;
    }

    updateRange(format(newFrom, 'yyyy-MM-dd'), format(newTo, 'yyyy-MM-dd'));
  };

  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl border border-border/60 bg-card shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="from-date" className="text-xs font-medium text-muted-foreground">
            From Date
          </Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="from-date"
              type="date"
              value={fromValue}
              onChange={handleFromChange}
              className="pl-9 h-10 w-[160px] text-sm"
              max={toValue}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="to-date" className="text-xs font-medium text-muted-foreground">
            To Date
          </Label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              id="to-date"
              type="date"
              value={toValue}
              onChange={handleToChange}
              className="pl-9 h-10 w-[160px] text-sm"
              min={fromValue}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyShortcut('today')}
          className="text-xs h-9"
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyShortcut('this-week')}
          className="text-xs h-9"
        >
          This Week
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyShortcut('this-month')}
          className="text-xs h-9"
        >
          This Month
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyShortcut('last-month')}
          className="text-xs h-9"
        >
          Last Month
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyShortcut('last-3-months')}
          className="text-xs h-9"
        >
          Last 3 Months
        </Button>
      </div>
    </div>
  );
}
