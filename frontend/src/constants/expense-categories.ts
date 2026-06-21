// frontend/src/constants/expense-categories.ts
// Purpose: Single source of truth for all operational expense categories,
//          defining visual colors, labels, and icons.

import { DollarSign, Wifi, Zap, Truck, Users, Wrench, MoreHorizontal } from 'lucide-react';

export const EXPENSE_CATEGORIES = [
  { value: 'rent',         label: 'Rent',          color: 'text-blue-600',     bgColor: 'bg-blue-50 dark:bg-blue-950/20',         icon: DollarSign },
  { value: 'salary',       label: 'Salary',        color: 'text-emerald-600',  bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',   icon: Users },
  { value: 'electricity',  label: 'Electricity',   color: 'text-amber-600',    bgColor: 'bg-amber-50 dark:bg-amber-950/20',       icon: Zap },
  { value: 'internet',     label: 'Internet',      color: 'text-purple-600',   bgColor: 'bg-purple-50 dark:bg-purple-950/20',     icon: Wifi },
  { value: 'transport',    label: 'Transport',     color: 'text-teal-600',     bgColor: 'bg-teal-50 dark:bg-teal-950/20',         icon: Truck },
  { value: 'maintenance',  label: 'Maintenance',   color: 'text-orange-600',   bgColor: 'bg-orange-50 dark:bg-orange-950/20',     icon: Wrench },
  { value: 'other',        label: 'Other',         color: 'text-muted-foreground', bgColor: 'bg-muted dark:bg-muted/30',       icon: MoreHorizontal },
] as const;

export type ExpenseCategoryValue = typeof EXPENSE_CATEGORIES[number]['value'];
