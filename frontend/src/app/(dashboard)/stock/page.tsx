// frontend/src/app/(dashboard)/stock/page.tsx
// Purpose: Stock management dashboard — manual stock-in/out forms,
//          movement history ledger, and valuation summary cards.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  PackagePlus, PackageMinus, ArrowUpDown, DollarSign,
  AlertTriangle, Calendar, RefreshCw
} from 'lucide-react';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { getDb } from '@/lib/db/dexie';
import { syncEngine } from '@/lib/sync/sync-engine';
import { formatCurrency, formatDateTime, getErrorMessage } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import type { StockMovementResponse, StockValuationResponse, ProductResponse } from '@/types/api';

// ─── Schema ──────────────────────────────────────────────────────────────────

const toNum = (val: unknown) => (val === '' || val === null || val === undefined ? 0 : Number(val));

const adjustSchema = z.object({
  product_id:    z.string().min(1, 'Please select a product'),
  movement_type: z.enum(['stock_in', 'stock_out', 'adjustment']),
  quantity:      z.preprocess(toNum, z.number().min(0.01, 'Quantity must be greater than 0')),
  unit_cost:     z.preprocess(toNum, z.number().min(0).optional()),
  notes:         z.string().max(500).optional().or(z.literal('')),
});

type AdjustFormValues = z.infer<typeof adjustSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [movements, setMovements] = useState<StockMovementResponse[]>([]);
  const [valuation, setValuation] = useState<StockValuationResponse | null>(null);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'stock_in' | 'stock_out' | 'adjustment'>('stock_in');

  const form = useForm<AdjustFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(adjustSchema) as any,
    defaultValues: {
      product_id:    '',
      movement_type: 'stock_in',
      quantity:      0,
      unit_cost:     0,
      notes:         '',
    },
  });

  // ─── Data Loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const db = getDb();

      // Load products from local IndexedDB for the selector
      const localProds = await db.products.toArray();
      setProducts(
        localProds.map((p) => ({
          id: p.id?.toString() ?? '',
          uuid: p.uuid,
          shopId: p.shopId.toString(),
          categoryId: p.categoryId?.toString() ?? null,
          supplierId: p.supplierId?.toString() ?? null,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          buyingPrice: p.buyingPrice,
          sellingPrice: p.sellingPrice,
          quantity: p.quantity,
          reorderLevel: p.reorderLevel,
          unit: p.unit,
          expiryDate: p.expiryDate,
          imageUrl: p.imageUrl,
          isActive: p.isActive,
          category: null,
          createdAt: '',
          updatedAt: '',
        }))
      );

      // Load movements and valuation from API
      if (navigator.onLine) {
        const [movRes, valRes] = await Promise.all([
          apiClient.get<{ success: boolean; data: StockMovementResponse[] }>('/stock/movements', {
            params: { per_page: 50 },
          }),
          apiClient.get<{ success: boolean; data: StockValuationResponse }>('/stock/valuation'),
        ]);

        setMovements(movRes.data.data);
        setValuation(valRes.data.data);
      }
    } catch (err: unknown) {
      console.warn('[StockPage] Load error:', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Submit Stock Adjustment ───────────────────────────────────────────────

  const onSubmit = async (values: AdjustFormValues) => {
    const db = getDb();

    // Find product from local cache
    const productId = parseInt(values.product_id);
    const localProduct = await db.products.get(productId);
    if (!localProduct) {
      toast.error('Product not found in local database.');
      return;
    }

    // Calculate signed delta for local IndexedDB
    const qty = values.quantity as number;
    const delta = values.movement_type === 'stock_in'
      ? qty
      : values.movement_type === 'stock_out'
        ? -qty
        : qty; // adjustment keeps signed value as provided

    const newQty = localProduct.quantity + delta;
    if (newQty < 0) {
      toast.error(`Insufficient stock: requested ${Math.abs(delta)}, available ${localProduct.quantity}.`);
      return;
    }

    try {
      // 1. Update product quantity in IndexedDB
      await db.products.update(productId, { quantity: newQty });

      // 2. Add stock movement to local IndexedDB
      const { nanoid } = await import('nanoid');
      const localUuid = nanoid();
      await db.stockMovements.add({
        uuid: localUuid,
        shopId: localProduct.shopId,
        productId,
        userId: 0,
        movementType: values.movement_type,
        delta,
        quantityBefore: localProduct.quantity,
        quantityAfter: newQty,
        unitCost: (values.unit_cost as number) || null,
        notes: values.notes || null,
        occurredAt: new Date().toISOString(),
        syncedAt: null,
        createdAt: new Date().toISOString(),
      });

      // 3. Enqueue to sync engine
      await syncEngine.enqueue('stock_movements', 'CREATE', {
        uuid: localUuid,
        product_id: productId,
        movement_type: values.movement_type,
        quantity: qty,
        unit_cost: (values.unit_cost as number) || null,
        notes: values.notes || null,
      });

      // 4. Background API call if online
      if (navigator.onLine) {
        apiClient.post(`/stock/adjust/${productId}`, {
          movement_type: values.movement_type,
          quantity: qty,
          unit_cost: (values.unit_cost as number) || null,
          notes: values.notes || null,
        }).then(() => loadData())
          .catch((err: unknown) => console.error('[StockPage] Adjust sync error:', getErrorMessage(err)));
      }

      toast.success('Stock adjustment recorded successfully.');
      form.reset();
      setIsSheetOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to record stock adjustment.');
    }
  };

  const openSheet = (type: 'stock_in' | 'stock_out' | 'adjustment') => {
    setSelectedType(type);
    form.setValue('movement_type', type);
    setIsSheetOpen(true);
  };

  // ─── Movement Type Styling ────────────────────────────────────────────────

  const movementStyles: Record<string, string> = {
    stock_in:   'bg-green-500/10 text-green-600',
    stock_out:  'bg-destructive/10 text-destructive',
    sale:       'bg-blue-500/10 text-blue-600',
    adjustment: 'bg-amber-500/10 text-amber-600',
  };

  const movementLabels: Record<string, string> = {
    stock_in:   'Stock In',
    stock_out:  'Stock Out',
    sale:       'Sale',
    adjustment: 'Adjustment',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Management</h1>
          <p className="text-muted-foreground mt-1">
            Record stock movements, track inventory adjustments, and monitor stock health.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => openSheet('stock_in')} className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
            <PackagePlus className="mr-2 h-4 w-4" /> Stock In
          </Button>
          <Button onClick={() => openSheet('stock_out')} variant="destructive" className="shadow-sm">
            <PackageMinus className="mr-2 h-4 w-4" /> Stock Out
          </Button>
          <Button onClick={() => openSheet('adjustment')} variant="outline" className="shadow-sm">
            <ArrowUpDown className="mr-2 h-4 w-4" /> Adjust
          </Button>
        </div>
      </div>

      {/* Valuation Summary Cards */}
      {valuation && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-xs flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10 text-green-600"><DollarSign className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Value</p>
              <h3 className="text-2xl font-bold">{formatCurrency(valuation.totalValue)}</h3>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-xs flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600"><PackagePlus className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total SKUs</p>
              <h3 className="text-2xl font-bold">{valuation.totalProducts}</h3>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border bg-card shadow-xs flex items-center gap-4 ${valuation.lowStockCount > 0 ? 'border-destructive/30' : 'border-border/60'}`}>
            <div className={`p-3 rounded-xl ${valuation.lowStockCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Low Stock</p>
              <h3 className={`text-2xl font-bold ${valuation.lowStockCount > 0 ? 'text-destructive' : ''}`}>{valuation.lowStockCount}</h3>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border bg-card shadow-xs flex items-center gap-4 ${valuation.expiringSoonCount > 0 ? 'border-amber-400/30' : 'border-border/60'}`}>
            <div className={`p-3 rounded-xl ${valuation.expiringSoonCount > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiring Soon</p>
              <h3 className={`text-2xl font-bold ${valuation.expiringSoonCount > 0 ? 'text-amber-600' : ''}`}>{valuation.expiringSoonCount}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Refresh Button + Section Label */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Movement Ledger</h2>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Movement History Table */}
      {movements.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/60 p-12 text-center bg-card">
          <PackagePlus className="h-10 w-10 text-muted-foreground/60 mb-3" />
          <h3 className="text-lg font-semibold">No stock movements yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Use the Stock In / Out buttons above to record your first inventory movement.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-28 text-right">Delta</TableHead>
                <TableHead className="w-28 text-right">Before</TableHead>
                <TableHead className="w-28 text-right">After</TableHead>
                <TableHead className="w-48">Timestamp</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.uuid} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-medium">
                    {m.product?.name ?? `Product #${m.productId}`}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${movementStyles[m.movementType] ?? 'bg-muted text-muted-foreground'}`}>
                      {movementLabels[m.movementType] ?? m.movementType}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${m.delta >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {m.delta >= 0 ? '+' : ''}{m.delta}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{m.quantityBefore}</TableCell>
                  <TableCell className="text-right font-semibold">{m.quantityAfter}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(m.occurredAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {m.notes || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Stock Adjustment Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md w-full bg-card overflow-y-auto">
          <SheetHeader className="mb-5">
            <SheetTitle>
              {selectedType === 'stock_in' ? '📦 Stock In' : selectedType === 'stock_out' ? '📤 Stock Out' : '⚖️ Adjustment'}
            </SheetTitle>
            <SheetDescription>
              {selectedType === 'stock_in'
                ? 'Record received goods from a supplier or transfer.'
                : selectedType === 'stock_out'
                  ? 'Record wastage, damage, or returns.'
                  : 'Make a manual stock correction with audit note.'}
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Movement Type (hidden on sheet open per type, allow change within) */}
              <FormField
                control={form.control}
                name="movement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Movement Type</FormLabel>
                    <Select onValueChange={(v) => {
                      field.onChange(v);
                      setSelectedType(v as 'stock_in' | 'stock_out' | 'adjustment');
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="stock_in">📦 Stock In (add)</SelectItem>
                        <SelectItem value="stock_out">📤 Stock Out (remove)</SelectItem>
                        <SelectItem value="adjustment">⚖️ Manual Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Product Selector */}
              <FormField
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select product…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            {p.sku ? ` (${p.sku})` : ''}
                            {' — '}
                            <span className="text-muted-foreground">Stock: {p.quantity} {p.unit}s</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity */}
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit Cost (stock_in only) */}
              {selectedType === 'stock_in' && (
                <FormField
                  control={form.control}
                  name="unit_cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Cost (KES)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="Optional buying cost" {...field} value={field.value as number} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes / Reason</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional audit note…" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsSheetOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className={selectedType === 'stock_in' ? 'bg-green-600 hover:bg-green-700' : selectedType === 'stock_out' ? '' : ''}
                  variant={selectedType === 'stock_out' ? 'destructive' : 'default'}
                >
                  {form.formState.isSubmitting ? 'Recording…' : 'Record Movement'}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
