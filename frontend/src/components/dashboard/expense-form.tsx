// frontend/src/components/dashboard/expense-form.tsx
// Purpose: Sheet form to add/edit operational expenses. Supports category selection,
//          amount with KES prefix, date selector, receipt image upload, and offline-first writes.

'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarIcon, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ImageUpload } from '@/components/dashboard/image-upload';
import { EXPENSE_CATEGORIES, type ExpenseCategoryValue } from '@/constants/expense-categories';
import { syncEngine } from '@/lib/sync/sync-engine';
import { getDb } from '@/lib/db/dexie';
import { getErrorMessage, generateUUID } from '@/lib/utils';
import type { ExpenseResponse } from '@/types/api';

const toNum = (val: unknown) => (val === '' || val === null || val === undefined ? 0 : Number(val));

const expenseSchema = z.object({
  category: z.enum(['rent', 'salary', 'electricity', 'internet', 'transport', 'maintenance', 'other'] as const),
  amount: z.preprocess(toNum, z.number().min(0.01, 'Amount must be greater than zero')),
  description: z.string().max(1000, 'Description must not exceed 1000 characters').optional().or(z.literal('')),
  expenseDate: z.string().refine((val) => {
    const date = new Date(val);
    const today = new Date();
    // Reset times to compare dates only
    today.setHours(23, 59, 59, 999);
    return date <= today;
  }, 'Expense date cannot be in the future'),
  receiptUrl: z.string().optional().or(z.literal('')),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseFormProps {
  expense?: ExpenseResponse;
  onSuccess: () => void;
}

export function ExpenseForm({ expense, onSuccess }: ExpenseFormProps) {
  const isEditMode = expense !== undefined;

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: {
      category: expense?.category ?? 'other',
      amount: expense?.amount ?? 0,
      description: expense?.description ?? '',
      expenseDate: expense?.expenseDate ?? format(new Date(), 'yyyy-MM-dd'),
      receiptUrl: expense?.receiptUrl ?? '',
    },
  });

  useEffect(() => {
    if (expense) {
      form.reset({
        category: expense.category,
        amount: expense.amount,
        description: expense.description ?? '',
        expenseDate: expense.expenseDate,
        receiptUrl: expense.receiptUrl ?? '',
      });
    } else {
      form.reset({
        category: 'other',
        amount: 0,
        description: '',
        expenseDate: format(new Date(), 'yyyy-MM-dd'),
        receiptUrl: '',
      });
    }
  }, [expense, form]);

  const watchedValues = form.watch();

  const onSubmit = async (values: ExpenseFormValues) => {
    const db = getDb();

    try {
      if (isEditMode && expense) {
        // ── UPDATE in Dexie ──
        await db.expenses.where('uuid').equals(expense.uuid).modify({
          category: values.category,
          amount: values.amount,
          description: values.description || null,
          expenseDate: values.expenseDate,
          receiptUrl: values.receiptUrl || null,
        });

        // ── Queue in Sync Engine ──
        await syncEngine.enqueue('expense', 'UPDATE', {
          id: expense.id,
          uuid: expense.uuid,
          category: values.category,
          amount: values.amount,
          description: values.description || null,
          expenseDate: values.expenseDate,
          receiptUrl: values.receiptUrl || null,
        });
      } else {
        // ── CREATE in Dexie ──
        const localUuid = generateUUID();

        await db.expenses.add({
          uuid: localUuid,
          shopId: 0,
          userId: 0,
          category: values.category,
          amount: values.amount,
          description: values.description || null,
          expenseDate: values.expenseDate,
          receiptUrl: values.receiptUrl || null,
          syncedAt: null,
          createdAt: new Date().toISOString(),
        });

        // ── Queue in Sync Engine ──
        await syncEngine.enqueue('expense', 'CREATE', {
          uuid: localUuid,
          category: values.category,
          amount: values.amount,
          description: values.description || null,
          expenseDate: values.expenseDate,
          receiptUrl: values.receiptUrl || null,
        });
      }

      toast.success('Expense saved successfully');
      onSuccess();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to save expense');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
        {/* Category Dropdown */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category <span className="text-destructive">*</span></FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="border-border">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <span className="flex items-center gap-2">
                        <cat.icon className={`h-4 w-4 ${cat.color}`} />
                        {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (KES) <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    KES
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-12 border-border"
                    placeholder="0.00"
                    {...field}
                    value={field.value as number}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date Selector (Popover with Calendar) */}
        <FormField
          control={form.control}
          name="expenseDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Expense Date <span className="text-destructive">*</span></FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={`w-full pl-3 text-left font-normal border-border ${
                        !field.value && "text-muted-foreground"
                      }`}
                    >
                      {field.value ? (
                        format(parseISO(field.value), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? parseISO(field.value) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        field.onChange(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description / Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional details (e.g. landlord info, bill month)"
                  className="resize-none border-border"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Receipt Image Upload */}
        <FormField
          control={form.control}
          name="receiptUrl"
          render={() => (
            <FormItem>
              <FormLabel>Receipt Image</FormLabel>
              <FormControl>
                <ImageUpload
                  value={watchedValues.receiptUrl ? [watchedValues.receiptUrl] : []}
                  onChange={(urls) => form.setValue('receiptUrl', urls[0] ?? '')}
                  onRemove={() => form.setValue('receiptUrl', '')}
                  folder="smartkiosk/expenses"
                  maxImages={1}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
          <Button type="button" variant="outline" onClick={onSuccess}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting} className="shadow-sm">
            {form.formState.isSubmitting ? (
              'Saving...'
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {isEditMode ? 'Update Expense' : 'Log Expense'}
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
