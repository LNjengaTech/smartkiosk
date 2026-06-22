// frontend/src/app/(dashboard)/expenses/page.tsx
// Purpose: Operational expenses dashboard listing with color-coded badges,
//          monthly summary cards, offline-first loading/sync, and sheet form trigger.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Receipt, Landmark, DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExpenseForm } from '@/components/dashboard/expense-form';
import { RoleGate } from '@/components/shared/role-gate';
import { EXPENSE_CATEGORIES } from '@/constants/expense-categories';
import { getDb } from '@/lib/db/dexie';
import { syncEngine } from '@/lib/sync/sync-engine';
import { getErrorMessage } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import type { ExpenseResponse } from '@/types/api';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Summary Metrics
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [monthlyLargest, setMonthlyLargest] = useState(0);

  const calculateMetrics = (items: ExpenseResponse[]) => {
    const today = new Date();
    const start = startOfMonth(today);
    const end = endOfMonth(today);

    let total = 0;
    let count = 0;
    let maxVal = 0;

    items.forEach((item) => {
      const date = parseISO(item.expenseDate);
      if (isWithinInterval(date, { start, end })) {
        total += item.amount;
        count += 1;
        if (item.amount > maxVal) {
          maxVal = item.amount;
        }
      }
    });

    setMonthlyTotal(total);
    setMonthlyCount(count);
    setMonthlyLargest(maxVal);
  };

  const loadExpenses = useCallback(async () => {
    try {
      const db = getDb();
      const localExpenses = await db.expenses.orderBy('expenseDate').reverse().toArray();

      const mappedExpenses: ExpenseResponse[] = localExpenses.map((exp) => ({
        id: exp.id?.toString() ?? '',
        uuid: exp.uuid,
        shopId: exp.shopId.toString(),
        userId: exp.userId.toString(),
        userName: 'Local Attendant', // Will be enriched on sync
        category: exp.category,
        amount: exp.amount,
        description: exp.description,
        expenseDate: exp.expenseDate,
        receiptUrl: exp.receiptUrl,
        syncedAt: exp.syncedAt,
        createdAt: exp.createdAt,
        updatedAt: exp.createdAt,
      }));

      setExpenses(mappedExpenses);
      calculateMetrics(mappedExpenses);
      setLoading(false);

      if (navigator.onLine) {
        try {
          // Fetch UUIDs pending deletion so we don't resurface them from the server
          const pendingDeleteUuids = await syncEngine.getPendingDeleteUuids('expense');

          // Fetch UUIDs of expenses with pending or processing updates in the sync queue
          const pendingOps = await db.syncQueue
            .where('status')
            .anyOf(['pending', 'processing'])
            .toArray();
          const pendingUpdateUuids = new Set(
            pendingOps
              .filter((op) => op.resource === 'expense')
              .map((op) => (op.payload as any)?.uuid)
              .filter(Boolean)
          );

          const response = await apiClient.get<{ success: boolean; data: ExpenseResponse[] }>('/expenses');
          const serverExpenses = response.data.data;

          await db.transaction('rw', db.expenses, async () => {
            const serverUuids = new Set(serverExpenses.map((e) => e.uuid));

            for (const sexp of serverExpenses) {
              // Skip expenses queued for deletion — don't resurrect them
              if (pendingDeleteUuids.has(sexp.uuid)) continue;
              // Skip updating expenses with local pending changes to avoid race conditions
              if (pendingUpdateUuids.has(sexp.uuid)) continue;

              const existing = await db.expenses.where('uuid').equals(sexp.uuid).first();
              if (existing) {
                await db.expenses.update(existing.id!, {
                  shopId: parseInt(sexp.shopId),
                  userId: parseInt(sexp.userId),
                  category: sexp.category,
                  amount: sexp.amount,
                  description: sexp.description,
                  expenseDate: sexp.expenseDate,
                  receiptUrl: sexp.receiptUrl,
                  syncedAt: new Date().toISOString(),
                });
              } else {
                await db.expenses.add({
                  uuid: sexp.uuid,
                  shopId: parseInt(sexp.shopId),
                  userId: parseInt(sexp.userId),
                  category: sexp.category,
                  amount: sexp.amount,
                  description: sexp.description,
                  expenseDate: sexp.expenseDate,
                  receiptUrl: sexp.receiptUrl,
                  syncedAt: new Date().toISOString(),
                  createdAt: sexp.createdAt,
                });
              }
            }

            // Remove local synced items that no longer exist on server
            const allLocal = await db.expenses.toArray();
            for (const lexp of allLocal) {
              if (lexp.syncedAt !== null && !serverUuids.has(lexp.uuid) && !pendingDeleteUuids.has(lexp.uuid)) {
                await db.expenses.delete(lexp.id!);
              }
            }
          });

          const updatedLocal = await db.expenses.orderBy('expenseDate').reverse().toArray();
          const finalExpenses: ExpenseResponse[] = updatedLocal
            .filter((exp) => !pendingDeleteUuids.has(exp.uuid))
            .map((exp) => {
            const matchedServer = serverExpenses.find((s) => s.uuid === exp.uuid);
            return {
              id: exp.id?.toString() ?? '',
              uuid: exp.uuid,
              shopId: exp.shopId.toString(),
              userId: exp.userId.toString(),
              userName: matchedServer?.userName ?? 'Logged User',
              category: exp.category,
              amount: exp.amount,
              description: exp.description,
              expenseDate: exp.expenseDate,
              receiptUrl: exp.receiptUrl,
              syncedAt: exp.syncedAt,
              createdAt: exp.createdAt,
              updatedAt: exp.createdAt,
            };
          });

          setExpenses(finalExpenses);
          calculateMetrics(finalExpenses);
        } catch (err: unknown) {
          console.warn('[Expenses] Failed to sync with backend:', getErrorMessage(err));
        }
      }
    } catch (error: unknown) {
      toast.error('Failed to load expenses');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleDelete = async (expense: ExpenseResponse) => {
    if (confirmDeleteId !== expense.uuid) {
      setConfirmDeleteId(expense.uuid);
      return;
    }

    try {
      const db = getDb();
      await db.expenses.where('uuid').equals(expense.uuid).delete();

      await syncEngine.enqueue('expense', 'DELETE', {
        id: expense.id ? parseInt(expense.id) : undefined,
        uuid: expense.uuid,
      });

      toast.success('Expense deleted successfully');
      setConfirmDeleteId(null);
      loadExpenses();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || 'Failed to delete expense');
    }
  };

  const handleEditClick = (expense: ExpenseResponse) => {
    setEditingExpense(expense);
    setIsSheetOpen(true);
  };

  const handleAddClick = () => {
    setEditingExpense(undefined);
    setIsSheetOpen(true);
  };

  const handleSheetSuccess = () => {
    setIsSheetOpen(false);
    loadExpenses();
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setConfirmDeleteId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground animate-pulse">Loading expenses page...</div>
      </div>
    );
  }

  return (
    <RoleGate anyRole={['owner', 'manager', 'super_admin']}>
      <div className="space-y-6 animate-fade-in" onClick={() => setConfirmDeleteId(null)}>
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expenses Ledger</h1>
            <p className="text-muted-foreground mt-1">
              Log operational costs, track receipt files, and manage monthly outflow statistics.
            </p>
          </div>
          <Button onClick={handleAddClick} className="shadow-sm w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Log Expense
          </Button>
        </div>

        {/* Monthly Summary Cards Strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                MTD Expenses
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <h3 className="text-2xl font-bold text-foreground">
                KES {monthlyTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Total logged this calendar month</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly Claims
              </CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <h3 className="text-2xl font-bold text-foreground">{monthlyCount} Claims</h3>
              <p className="text-xs text-muted-foreground mt-1">Number of transactions processed</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Largest Claim
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <h3 className="text-2xl font-bold text-foreground">
                KES {monthlyLargest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">Single maximum expense logged</p>
            </CardContent>
          </Card>
        </div>

        {/* Expenses List / Table */}
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center bg-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Landmark className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No expenses logged yet</h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Log your shop expenses to get an accurate view of operational profit margins.
            </p>
            <Button onClick={handleAddClick} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Log Expense
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-36">Date</TableHead>
                  <TableHead className="w-36">Category</TableHead>
                  <TableHead>Description / Notes</TableHead>
                  <TableHead className="w-40 text-right">Amount (KES)</TableHead>
                  <TableHead className="w-24 text-center">Receipt</TableHead>
                  <TableHead className="w-36 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => {
                  const catConfig = EXPENSE_CATEGORIES.find((c) => c.value === expense.category) || {
                    label: expense.category,
                    color: 'text-muted-foreground',
                    bgColor: 'bg-muted',
                  };

                  return (
                    <TableRow key={expense.uuid} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(parseISO(expense.expenseDate), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`${catConfig.bgColor} ${catConfig.color} font-medium border-0 rounded-lg px-2.5 py-0.5`}
                        >
                          {catConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {expense.description || <span className="text-muted-foreground/45 italic">No notes</span>}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {expense.receiptUrl ? (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors shadow-xs"
                            title="View Receipt Image"
                          >
                            <Receipt className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditClick(expense)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={confirmDeleteId === expense.uuid ? 'destructive' : 'ghost'}
                            onClick={() => handleDelete(expense)}
                            className="h-8 min-w-[70px]"
                          >
                            {confirmDeleteId === expense.uuid ? (
                              'Confirm'
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Slide-out Sheet Drawer */}
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent className="sm:max-w-md w-full bg-card overflow-y-auto border-l border-border/80">
            <SheetHeader className="mb-4">
              <SheetTitle>
                {editingExpense ? 'Edit Expense Record' : 'Log New Expense'}
              </SheetTitle>
              <SheetDescription>
                {editingExpense
                  ? 'Update the operational expense claims and details below.'
                  : 'Enter new business costs and receipts into the system ledger.'}
              </SheetDescription>
            </SheetHeader>
            <ExpenseForm
              expense={editingExpense}
              onSuccess={handleSheetSuccess}
            />
          </SheetContent>
        </Sheet>
      </div>
    </RoleGate>
  );
}
