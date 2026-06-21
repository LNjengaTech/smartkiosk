'use client';

// src/app/(dashboard)/pos/page.tsx
// Purpose: POS screen — SmartScan + product search on left, cart on right.
//          Accessible to all roles (cashier, manager, owner).
//          Fully offline-first — all reads from IndexedDB, API is secondary.

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ShoppingCart,
  ScanLine,
  Search,
  X,
  Minus,
  Plus,
  Trash2,
  PauseCircle,
  Clock,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/stores/cart-store';
import { SmartScanModal } from '@/components/pos/smart-scan-modal';
import { PaymentCash } from '@/components/pos/payment-cash';
import { PaymentMpesa } from '@/components/pos/payment-mpesa';
import { PaymentBank } from '@/components/pos/payment-bank';
import { PaymentMixed } from '@/components/pos/payment-mixed';
import { SaleConfirmDialog } from '@/components/pos/sale-confirm-dialog';
import { HeldCartsPanel } from '@/components/pos/held-carts-panel';
import { PosDataLoader } from '@/components/pos/pos-data-loader';
import { cn } from '@/lib/utils';
import type { ProductResponse } from '@/types/api';
import type { LocalProduct } from '@/types/db';

// ─── Local product → ProductResponse mapper ────────────────────────────────────

function localToProductResponse(p: LocalProduct): ProductResponse {
  return {
    id: String(p.id ?? ''),
    uuid: p.uuid,
    shopId: String(p.shopId),
    categoryId: p.categoryId ? String(p.categoryId) : null,
    supplierId: p.supplierId ? String(p.supplierId) : null,
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
  };
}

// ─── Product Tile ─────────────────────────────────────────────────────────────

function ProductTile({
  product,
  onAdd,
}: {
  product: LocalProduct;
  onAdd: (p: ProductResponse) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(localToProductResponse(product))}
      disabled={product.quantity <= 0}
      className={cn(
        'group relative flex flex-col items-start gap-1.5 rounded-xl border border-border',
        'bg-card p-3 text-left transition-all duration-150 hover:border-primary/50',
        'hover:shadow-md active:scale-[0.97] cursor-pointer',
        product.quantity <= 0 && 'opacity-50 cursor-not-allowed',
      )}
    >
      {/* Product image or icon */}
      <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted flex items-center justify-center mb-1">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>

      {/* Name */}
      <p className="text-xs font-medium line-clamp-2 leading-tight">{product.name}</p>

      {/* Price */}
      <p className="text-sm font-bold text-primary font-mono">
        KES {product.sellingPrice.toLocaleString('en-KE')}
      </p>

      {/* Stock badge */}
      {product.quantity <= product.reorderLevel && product.quantity > 0 && (
        <span className="absolute top-2 right-2 text-[9px] bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
          Low
        </span>
      )}
      {product.quantity <= 0 && (
        <span className="absolute top-2 right-2 text-[9px] bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-medium">
          Out
        </span>
      )}
    </button>
  );
}

// ─── Main POS Page ─────────────────────────────────────────────────────────────

export default function PosPage() {
  const cart = useCartStore();
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [recentProducts, setRecentProducts] = useState<LocalProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocalProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load products from IndexedDB ─────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      try {
        const { db } = await import('@/lib/db/dexie');
        const all = await db.products.filter((p) => p.isActive).toArray();
        setProducts(all);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Failed to load products';
        console.error('[POS] Failed to load products from IndexedDB:', msg);
      }
    })();
  }, []);

  // ── Rehydrate cart from Dexie on mount ───────────────────────────────────────

  useEffect(() => {
    void cart.rehydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search (debounced 300ms) ─────────────────────────────────────────────────

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { db } = await import('@/lib/db/dexie');
      const q = query.toLowerCase();
      const results = await db.products
        .filter(
          (p) =>
            p.isActive &&
            (p.name.toLowerCase().includes(q) ||
              (p.sku?.toLowerCase().includes(q) ?? false) ||
              (p.barcode?.includes(q) ?? false)),
        )
        .limit(30)
        .toArray();
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, runSearch]);

  // ── Add to cart ──────────────────────────────────────────────────────────────

  const handleProductFound = (product: ProductResponse) => {
    cart.addItem(product);
    // Track recently scanned
    setRecentProducts((prev) => {
      const filtered = prev.filter((p) => p.uuid !== product.uuid);
      const asLocal: LocalProduct = {
        uuid: product.uuid,
        shopId: parseInt(product.shopId, 10) || 0,
        categoryId: product.categoryId ? parseInt(product.categoryId, 10) : null,
        supplierId: product.supplierId ? parseInt(product.supplierId, 10) : null,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        buyingPrice: product.buyingPrice,
        sellingPrice: product.sellingPrice,
        quantity: product.quantity,
        reorderLevel: product.reorderLevel,
        unit: product.unit,
        expiryDate: product.expiryDate,
        imageUrl: product.imageUrl,
        isActive: product.isActive,
        syncedAt: null,
      };
      return [asLocal, ...filtered].slice(0, 8);
    });
    toast.success(`${product.name} added to cart`);
  };

  const displayProducts = searchQuery.trim() ? searchResults : products;
  const total = cart.getTotal();
  const itemCount = cart.getItemCount();

  // ── Cart panel (shared desktop + mobile) ─────────────────────────────────────

  const CartPanel = (
    <div className="flex flex-col h-full">
      {/* Cart header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span className="font-semibold">Cart</span>
          {itemCount > 0 && (
            <Badge variant="secondary" className="h-5 text-xs px-1.5">
              {itemCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => cart.holdCart()}
            disabled={cart.items.length === 0}
          >
            <PauseCircle className="h-3.5 w-3.5" />
            Hold
          </Button>
          {cart.heldCarts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-amber-600"
              onClick={() => setHeldOpen(true)}
            >
              <Clock className="h-3.5 w-3.5" />
              {cart.heldCarts.length}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
            onClick={cart.clearCart}
            disabled={cart.items.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      {/* Cart items */}
      <ScrollArea className="flex-1 px-3 py-2">
        {cart.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Cart is empty</p>
            <p className="text-xs text-muted-foreground/60">Add items from the grid</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.items.map((item) => (
              <div
                key={item.productUuid}
                className="flex items-center gap-3 rounded-lg bg-muted/40 p-2.5"
              >
                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    KES {item.unitPrice.toLocaleString('en-KE')}
                  </p>
                </div>

                {/* Quantity stepper */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => cart.updateQuantity(item.productUuid, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-7 text-center text-xs font-semibold tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => cart.updateQuantity(item.productUuid, item.quantity + 1)}
                    disabled={item.quantity >= item.maxQuantity}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {/* Line total */}
                <p className="text-xs font-semibold font-mono shrink-0 w-20 text-right">
                  KES {(item.unitPrice * item.quantity).toLocaleString('en-KE')}
                </p>

                {/* Remove */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => cart.removeItem(item.productUuid)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Subtotal + Total */}
      {cart.items.length > 0 && (
        <div className="border-t px-4 py-3 space-y-1 shrink-0">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-mono">KES {cart.getSubtotal().toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="font-mono">KES {total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* Payment method */}
      {cart.items.length > 0 && (
        <div className="border-t px-4 py-3 space-y-3 shrink-0">
          <Tabs
            value={cart.paymentMethod}
            onValueChange={(v) => cart.setPaymentMethod(v as typeof cart.paymentMethod)}
          >
            <TabsList className="w-full grid grid-cols-4 h-9">
              <TabsTrigger value="cash" className="text-xs">Cash</TabsTrigger>
              <TabsTrigger value="mpesa" className="text-xs">M-Pesa</TabsTrigger>
              <TabsTrigger value="bank" className="text-xs">Bank</TabsTrigger>
              <TabsTrigger value="mixed" className="text-xs">Mixed</TabsTrigger>
            </TabsList>

            <TabsContent value="cash" className="mt-3">
              <PaymentCash
                total={total}
                amountPaid={cart.amountPaid}
                onAmountChange={cart.setAmountPaid}
              />
            </TabsContent>
            <TabsContent value="mpesa" className="mt-3">
              <PaymentMpesa
                total={total}
                onReferenceChange={cart.setMpesaReference}
              />
            </TabsContent>
            <TabsContent value="bank" className="mt-3">
              <PaymentBank
                onReferenceChange={cart.setBankReference}
              />
            </TabsContent>
            <TabsContent value="mixed" className="mt-3">
              <PaymentMixed
                total={total}
                split={cart.paymentSplit}
                onSplitChange={cart.setPaymentSplit}
              />
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Confirm sale */}
          <Button
            className="w-full h-12 text-base font-bold rounded-full gap-2"
            disabled={!cart.canCompleteSale()}
            onClick={() => setConfirmOpen(true)}
          >
            <ShoppingCart className="h-5 w-5" />
            Confirm Sale — KES {total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Background data pre-loader — renders null */}
      <PosDataLoader />

      {/* ── Desktop layout ────────────────────────────────────────────────────── */}
      <div className="hidden md:grid h-[calc(100vh-4rem)] grid-cols-[1fr_400px] overflow-hidden">
        {/* Left — product discovery */}
        <div className="flex flex-col overflow-hidden border-r border-border/60">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or barcode…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="outline"
              className="gap-2 shrink-0"
              onClick={() => setScanOpen(true)}
            >
              <ScanLine className="h-4 w-4" />
              Scan
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {/* Recently scanned */}
            {!searchQuery && recentProducts.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Recently scanned
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                  {recentProducts.map((p) => (
                    <ProductTile key={p.uuid} product={p} onAdd={handleProductFound} />
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            )}

            {/* Product grid */}
            <div className="px-4 py-4">
              {searchQuery && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {isSearching ? 'Searching…' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
                </p>
              )}
              {!searchQuery && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  All products ({products.length})
                </p>
              )}

              {displayProducts.length === 0 && !isSearching ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Package className="h-12 w-12 mb-2 opacity-30" />
                  <p className="text-sm">
                    {searchQuery ? 'No products match your search' : 'No products found'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {displayProducts.map((p) => (
                    <ProductTile key={p.uuid} product={p} onAdd={handleProductFound} />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right — cart */}
        <div className="overflow-hidden">{CartPanel}</div>
      </div>

      {/* ── Mobile layout ─────────────────────────────────────────────────────── */}
      <div className="md:hidden flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border/60 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>

        {/* Product grid — fills available space */}
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="grid grid-cols-3 gap-2">
            {displayProducts.map((p) => (
              <ProductTile key={p.uuid} product={p} onAdd={handleProductFound} />
            ))}
          </div>
        </ScrollArea>

        {/* Floating cart button */}
        {itemCount > 0 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 no-print">
            <Button
              size="lg"
              className="h-14 rounded-full px-6 shadow-2xl gap-3 font-bold"
              onClick={() => setMobileCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount} item{itemCount !== 1 ? 's' : ''} · KES {total.toLocaleString('en-KE')}
            </Button>
          </div>
        )}

        {/* Mobile cart bottom drawer */}
        {mobileCartOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50">
            <div className="bg-background rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
                <span className="font-semibold">Cart</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileCartOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">{CartPanel}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals & panels ────────────────────────────────────────────────────── */}
      <SmartScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onProductFound={handleProductFound}
      />

      <HeldCartsPanel
        open={heldOpen}
        onClose={() => setHeldOpen(false)}
      />

      <SaleConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
