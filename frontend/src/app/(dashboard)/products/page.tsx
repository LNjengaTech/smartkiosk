// frontend/app/(dashboard)/products/page.tsx
// Purpose: Core product catalogue manager. Displays inventory statistics,
//          robust searching/filtering, and handles offline-first data synchronization.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, AlertCircle, ShoppingBag, DollarSign, Calendar, Layers, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductForm } from '@/components/dashboard/product-form';
import { getDb } from '@/lib/db/dexie';
import { syncEngine } from '@/lib/sync/sync-engine';
import { getErrorMessage, formatCurrency } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import type { ProductResponse, CategoryResponse, ProductListResponse } from '@/types/api';

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Form / modal controls
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductResponse | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filtering / Search state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'low_stock' | 'expiring' | 'inactive'>('all');

  // Stats
  const [stats, setStats] = useState({
    totalCount: 0,
    lowStockCount: 0,
    expiringSoonCount: 0,
    totalValue: 0,
  });

  // ─── Fetch & Reconcile Catalogue ──────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const db = getDb();

      // 1. Load categories from IndexedDB
      const localCats = await db.categories.toArray();
      setCategories(
        localCats.map((c) => ({
          id: c.id?.toString() ?? '',
          uuid: c.uuid,
          shopId: c.shopId.toString(),
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl,
          productCount: (c as unknown as { productCount?: number }).productCount ?? 0,
          createdAt: '',
          updatedAt: '',
        }))
      );

      // 2. Load products from IndexedDB
      const localProds = await db.products.toArray();

      // Fetch categories map for fast lookup
      const catMap = new Map(localCats.map((c) => [c.id, c.name]));

      const mappedProds: ProductResponse[] = localProds.map((p) => ({
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
        category: p.categoryId ? { id: p.categoryId.toString(), name: catMap.get(p.categoryId) ?? '' } : null,
        createdAt: '',
        updatedAt: '',
      }));

      setProducts(mappedProds);
      calculateStats(mappedProds);
      setLoading(false);

      // 3. Reconcile with API if online
      if (navigator.onLine) {
        try {
          // Fetch UUIDs pending deletion so we don't resurface them from the server
          const pendingDeleteUuids = await syncEngine.getPendingDeleteUuids('product');

          // Fetch UUIDs of products with pending or processing updates in the sync queue
          const pendingOps = await db.syncQueue
            .where('status')
            .anyOf(['pending', 'processing'])
            .toArray();
          const pendingUpdateUuids = new Set(
            pendingOps
              .filter((op) => op.resource === 'product')
              .map((op) => (op.payload as any)?.uuid)
              .filter(Boolean)
          );

          const response = await apiClient.get<ProductListResponse>('/products', {
            params: { per_page: 200 },
          });
          const serverProds = response.data.data;

          await db.transaction('rw', db.products, async () => {
            // Upsert / overwrite server records in Dexie
            for (const sprod of serverProds) {
              // Skip products queued for deletion — don't resurrect them
              if (pendingDeleteUuids.has(sprod.uuid)) continue;
              // Skip updating products with local pending changes to avoid race conditions
              if (pendingUpdateUuids.has(sprod.uuid)) continue;

              const existing = await db.products.where('uuid').equals(sprod.uuid).first();
              if (existing) {
                await db.products.update(existing.id!, {
                  categoryId: sprod.categoryId ? parseInt(sprod.categoryId) : null,
                  supplierId: sprod.supplierId ? parseInt(sprod.supplierId) : null,
                  name: sprod.name,
                  sku: sprod.sku,
                  barcode: sprod.barcode,
                  buyingPrice: sprod.buyingPrice,
                  sellingPrice: sprod.sellingPrice,
                  quantity: sprod.quantity,
                  reorderLevel: sprod.reorderLevel,
                  unit: sprod.unit,
                  expiryDate: sprod.expiryDate,
                  imageUrl: sprod.imageUrl,
                  isActive: sprod.isActive,
                  syncedAt: new Date().toISOString(),
                });
              } else {
                await db.products.add({
                  uuid: sprod.uuid,
                  shopId: parseInt(sprod.shopId),
                  categoryId: sprod.categoryId ? parseInt(sprod.categoryId) : null,
                  supplierId: sprod.supplierId ? parseInt(sprod.supplierId) : null,
                  name: sprod.name,
                  sku: sprod.sku,
                  barcode: sprod.barcode,
                  buyingPrice: sprod.buyingPrice,
                  sellingPrice: sprod.sellingPrice,
                  quantity: sprod.quantity,
                  reorderLevel: sprod.reorderLevel,
                  unit: sprod.unit,
                  expiryDate: sprod.expiryDate,
                  imageUrl: sprod.imageUrl,
                  isActive: sprod.isActive,
                  syncedAt: new Date().toISOString(),
                });
              }
            }

            // Remove synced local items that no longer exist on server
            const serverUuids = new Set(serverProds.map((sp) => sp.uuid));
            const allLocal = await db.products.toArray();
            for (const lp of allLocal) {
              // Only delete synced items the server no longer knows about;
              // leave pending-delete items alone — drain will handle them.
              if (lp.syncedAt !== null && !serverUuids.has(lp.uuid) && !pendingDeleteUuids.has(lp.uuid)) {
                await db.products.delete(lp.id!);
              }
            }
          });

          // Reload updated local items
          const freshLocal = await db.products.toArray();
          const freshMapped = freshLocal
            // Exclude products that are pending deletion from the UI
            .filter((p) => !pendingDeleteUuids.has(p.uuid))
            .map((p) => ({
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
              category: p.categoryId ? { id: p.categoryId.toString(), name: catMap.get(p.categoryId) ?? '' } : null,
              createdAt: '',
              updatedAt: '',
            }));

          setProducts(freshMapped);
          calculateStats(freshMapped);
        } catch (err: unknown) {
          console.warn('[Products] Background API sync failed:', getErrorMessage(err));
        }
      }
    } catch (err: unknown) {
      toast.error('Failed to load products database.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (prods: ProductResponse[]) => {
    let totalVal = 0;
    let lowCount = 0;
    let expiringCount = 0;

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    prods.forEach((p) => {
      totalVal += p.buyingPrice * p.quantity;
      if (p.quantity <= p.reorderLevel) {
        lowCount++;
      }
      if (p.expiryDate) {
        const expDate = new Date(p.expiryDate);
        if (expDate >= new Date() && expDate <= sevenDaysFromNow) {
          expiringCount++;
        }
      }
    });

    setStats({
      totalCount: prods.length,
      lowStockCount: lowCount,
      expiringSoonCount: expiringCount,
      totalValue: totalVal,
    });
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Filters & Search ──────────────────────────────────────────────────────

  const filteredProducts = products.filter((p) => {
    // 1. Search Query
    const query = search.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(query) ||
      (p.sku && p.sku.toLowerCase().includes(query)) ||
      (p.barcode && p.barcode.includes(query));

    // 2. Category Dropdown Filter
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;

    // 3. Active Status Tabs
    let matchesTab = true;
    if (activeTab === 'low_stock') {
      matchesTab = p.quantity <= p.reorderLevel;
    } else if (activeTab === 'expiring') {
      if (p.expiryDate) {
        const expDate = new Date(p.expiryDate);
        const sevenDays = new Date();
        sevenDays.setDate(sevenDays.getDate() + 7);
        matchesTab = expDate >= new Date() && expDate <= sevenDays;
      } else {
        matchesTab = false;
      }
    } else if (activeTab === 'inactive') {
      matchesTab = !p.isActive;
    }

    return matchesSearch && matchesCategory && matchesTab;
  });

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleDelete = async (prod: ProductResponse) => {
    if (confirmDeleteId !== prod.uuid) {
      setConfirmDeleteId(prod.uuid);
      return;
    }

    try {
      const db = getDb();

      // 1. Optimistic local delete
      await db.products.where('uuid').equals(prod.uuid).delete();

      // 2. Queue in Sync Engine
      await syncEngine.enqueue('product', 'DELETE', {
        id: prod.id ? parseInt(prod.id) : undefined,
        uuid: prod.uuid,
      });

      toast.success('Product removed successfully');
      setConfirmDeleteId(null);
      // Optimistically remove from UI state immediately (don't reload from server
      // until sync engine has flushed the DELETE — otherwise the server record
      // would be re-fetched and the item would reappear).
      setProducts((prev) => prev.filter((p) => p.uuid !== prod.uuid));
    } catch (err: unknown) {
      console.error('[ProductsPage] Delete error:', err);
      toast.error(getErrorMessage(err) || 'Failed to remove product.');
    }
  };

  const handleEditClick = (p: ProductResponse) => {
    setEditingProduct(p);
    setIsSheetOpen(true);
  };

  const handleAddClick = () => {
    setEditingProduct(undefined);
    setIsSheetOpen(true);
  };

  const handleFormSuccess = () => {
    setIsSheetOpen(false);
    loadData();
  };

  useEffect(() => {
    const handleOutsideClick = () => setConfirmDeleteId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-muted-foreground">Loading inventory catalog...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" onClick={() => setConfirmDeleteId(null)}>
      {/* Top Header Grid */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products Catalogue</h1>
          <p className="text-muted-foreground mt-1">
            Publish products, verify scan tags, and view stock status alerts.
          </p>
        </div>
        <Button onClick={handleAddClick} className="shadow-sm w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      {/* Stats Cards Section */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total items */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Products</p>
            <h3 className="text-2xl font-bold">{stats.totalCount}</h3>
          </div>
        </div>

        {/* Total Stock Valuation */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stock Value</p>
            <h3 className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</h3>
          </div>
        </div>

        {/* Low Stock Warning */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-4">
          <div className={`p-3 rounded-xl ${stats.lowStockCount > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Low Stock alerts</p>
            <h3 className="text-2xl font-bold">{stats.lowStockCount}</h3>
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-4">
          <div className={`p-3 rounded-xl ${stats.expiringSoonCount > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expiring soon</p>
            <h3 className="text-2xl font-bold">{stats.expiringSoonCount}</h3>
          </div>
        </div>
      </div>

      {/* Searching & Filter Tabs Bar */}
      <div className="flex flex-col gap-4">
        {/* Filter Selection Tabs */}
        <div className="flex flex-wrap gap-1 bg-muted/40 p-1 rounded-xl border border-border/40 w-fit">
          <Button
            size="sm"
            variant={activeTab === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('all')}
            className="rounded-lg text-xs"
          >
            All Products
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'low_stock' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('low_stock')}
            className="rounded-lg text-xs flex items-center gap-1.5"
          >
            <span className="h-2 w-2 rounded-full bg-destructive" /> Low Stock
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'expiring' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('expiring')}
            className="rounded-lg text-xs flex items-center gap-1.5"
          >
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Expiring Soon
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'inactive' ? 'secondary' : 'ghost'}
            onClick={() => setActiveTab('inactive')}
            className="rounded-lg text-xs"
          >
            Drafts / Inactive
          </Button>
        </div>

        {/* Search Inputs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, barcode, or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48 bg-card">
              <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Catalogue Table */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-12 text-center bg-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ShoppingBag className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No products found</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm">
            Try adjusting your search criteria, category filter, or add a new product.
          </p>
          <Button onClick={handleAddClick} variant="outline" className="mt-4">
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>Product Info</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Buying Price</TableHead>
                <TableHead className="text-right">Selling Price</TableHead>
                <TableHead className="text-center">Stock Level</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => {
                const isLow = p.quantity <= p.reorderLevel;

                return (
                  <TableRow key={p.uuid} className="hover:bg-muted/10 transition-colors">
                    {/* Thumbnail Image */}
                    <TableCell>
                      <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border bg-muted flex items-center justify-center">
                        {p.imageUrl ? (
                          <Image
                            src={p.imageUrl}
                            alt={p.name}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                        )}
                      </div>
                    </TableCell>

                    {/* Product Name & SKU */}
                    <TableCell>
                      <div className="font-semibold text-foreground truncate max-w-xs">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5 uppercase">
                        SKU: {p.sku || 'N/A'} · Barcode: {p.barcode || 'N/A'}
                      </div>
                    </TableCell>

                    {/* Category Label */}
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                        {p.category?.name || 'Unassigned'}
                      </span>
                    </TableCell>

                    {/* Buying Cost */}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(p.buyingPrice)}
                    </TableCell>

                    {/* Selling Cost */}
                    <TableCell className="text-right font-bold text-primary">
                      {formatCurrency(p.sellingPrice)}
                    </TableCell>

                    {/* Quantity & Unit */}
                    <TableCell className="text-center">
                      <div className={`font-bold text-sm ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                        {p.quantity} {p.unit}s
                      </div>
                      {isLow && (
                        <div className="text-[9px] text-destructive font-semibold uppercase tracking-wider mt-0.5">
                          Low Stock alert
                        </div>
                      )}
                    </TableCell>

                    {/* Active State status */}
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                        p.isActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {p.isActive ? 'Active' : 'Draft'}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditClick(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant={confirmDeleteId === p.uuid ? 'destructive' : 'ghost'}
                          onClick={() => handleDelete(p)}
                          className="min-w-[80px]"
                        >
                          {confirmDeleteId === p.uuid ? (
                            'Confirm?'
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

      {/* Slide-out Add/Edit Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md w-full bg-card overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>
              {editingProduct ? 'Edit Catalog Product' : 'Add New Product'}
            </SheetTitle>
            <SheetDescription>
              Provide catalog attributes to publish to your shop inventory.
            </SheetDescription>
          </SheetHeader>
          <ProductForm
            product={editingProduct}
            onSuccess={handleFormSuccess}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
