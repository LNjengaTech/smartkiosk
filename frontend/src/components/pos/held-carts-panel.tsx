'use client';

// src/components/pos/held-carts-panel.tsx
// Purpose: Sheet showing held (paused) carts that can be restored or deleted.

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { PauseCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useCartStore } from '@/lib/stores/cart-store';
import type { HeldCart } from '@/types/pos';

// ─── Props ────────────────────────────────────────────────────────────────────

interface HeldCartsPanelProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HeldCartsPanel({ open, onClose }: HeldCartsPanelProps) {
  const { heldCarts, restoreHeldCart, deleteHeldCart } = useCartStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleRestore = (id: string) => {
    restoreHeldCart(id);
    onClose();
  };

  const handleDelete = (cart: HeldCart) => {
    if (confirmDeleteId === cart.id) {
      deleteHeldCart(cart.id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(cart.id);
      // Auto-cancel confirm after 3s
      setTimeout(() => setConfirmDeleteId((prev) => (prev === cart.id ? null : prev)), 3000);
    }
  };

  const cartTotal = (cart: HeldCart) =>
    cart.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const itemCount = (cart: HeldCart) =>
    cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-amber-500" />
            Held Carts
            {heldCarts.length > 0 && (
              <span className="ml-auto text-xs font-normal bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                {heldCarts.length}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {heldCarts.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <PauseCircle className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No held carts</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Hold an active cart to serve multiple customers.
              </p>
            </div>
          ) : (
            heldCarts
              .slice()
              .reverse() // newest first
              .map((cart) => (
                <div
                  key={cart.id}
                  className="rounded-xl border border-border bg-card p-4 space-y-3"
                >
                  {/* Cart info */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{cart.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cart.items.length} product{cart.items.length !== 1 ? 's' : ''} · {itemCount(cart)} units
                      </p>
                    </div>
                    <p className="text-sm font-semibold font-mono shrink-0">
                      KES {cartTotal(cart).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Item previews */}
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {cart.items.slice(0, 3).map((item) => (
                      <p key={item.productUuid} className="truncate">
                        {item.quantity}× {item.name}
                      </p>
                    ))}
                    {cart.items.length > 3 && (
                      <p>+{cart.items.length - 3} more…</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => handleRestore(cart.id)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant={confirmDeleteId === cart.id ? 'destructive' : 'outline'}
                      className="gap-1.5"
                      onClick={() => handleDelete(cart)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {confirmDeleteId === cart.id ? 'Confirm?' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
