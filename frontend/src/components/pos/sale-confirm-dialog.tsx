'use client';

// src/components/pos/sale-confirm-dialog.tsx
// Purpose: Final sale confirmation — summary and submit. Handles offline-first
//          sale creation and receipt display.

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/lib/stores/cart-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ReceiptModal } from '@/components/pos/receipt-modal';
import type { ReceiptData, SalePayload, SaleItemPayload } from '@/types/pos';

// ─── Tiny cha-ching audio ─────────────────────────────────────────────────────

const CHACHING_URI =
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoGAACBhYqPk5ebn6OmqayvsLKztLW2t7i4uLi4t7a1tLKxr62rqKWioJ2amJWSkI2KiIWCf3x6d3RycG1raGZkYmBfXVtaWFdWVFNSUVBPTk1MTEtKSklJSEhHR0dHR0dHR0dHR0hISUlKSkpLS0xMTU5OT1BRUlNUVVZXWFlaW1xdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SaleConfirmDialogProps {
  open: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SaleConfirmDialog({ open, onClose }: SaleConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const cart = useCartStore();
  const { user, shop } = useAuthStore();

  const subtotal = cart.getSubtotal();
  const total = cart.getTotal();
  const change = cart.getChange();
  const itemCount = cart.getItemCount();

  const handleCompleteSale = async () => {
    if (!user || !shop) {
      toast.error('Session error', { description: 'Please log in again.' });
      return;
    }

    setIsSubmitting(true);

    try {
      const { nanoid } = await import('nanoid');
      const { db } = await import('@/lib/db/dexie');
      const { syncEngine } = await import('@/lib/sync/sync-engine');

      const saleUuid = nanoid();

      // Build receipt number (client-side placeholder — updated by server on sync)
      const year = new Date().getFullYear();
      const receiptNumber = `SK-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Build sale items payload
      const saleItems: SaleItemPayload[] = cart.items.map((item) => ({
        uuid: nanoid(),
        productUuid: item.productUuid,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        buyingPrice: item.buyingPrice,
        discount: 0,
        total: item.unitPrice * item.quantity,
      }));

      const salePayload: SalePayload = {
        uuid: saleUuid,
        shopId: shop.uuid,
        userId: user.uuid,
        items: saleItems,
        paymentMethod: cart.paymentMethod,
        paymentSplit: cart.paymentSplit,
        amountPaid: cart.amountPaid,
        mpesaReference: cart.mpesaReference,
        bankReference: cart.bankReference,
        notes: cart.notes,
        soldAt: new Date().toISOString(),
      };

      // ── Step 1: Write sale to IndexedDB immediately ──────────────────────────
      await db.sales.add({
        uuid: saleUuid,
        shopId: Number(shop.uuid) || 0,
        userId: Number(user.uuid) || 0,
        receiptNumber,
        subtotal,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: total,
        amountPaid: cart.amountPaid,
        changeAmount: change,
        paymentMethod: cart.paymentMethod,
        mpesaReference: cart.mpesaReference,
        status: 'completed',
        notes: cart.notes,
        items: saleItems.map((si) => ({
          uuid: si.uuid,
          productId: null,
          productName: si.productName,
          quantity: si.quantity,
          unitPrice: si.unitPrice,
          buyingPrice: si.buyingPrice,
          discount: si.discount,
          total: si.total,
        })),
        soldAt: salePayload.soldAt,
        syncedAt: null,
        createdAt: new Date().toISOString(),
      });

      // ── Step 2: Apply stock delta in IndexedDB for each item ─────────────────
      for (const item of cart.items) {
        await db.products
          .where('uuid')
          .equals(item.productUuid)
          .modify((p) => {
            p.quantity = Math.max(0, p.quantity - item.quantity);
          });
      }

      // ── Step 3: Enqueue to sync engine ───────────────────────────────────────
      await syncEngine.enqueue('sale', 'CREATE', salePayload);

      // ── Step 4: Clear cart ───────────────────────────────────────────────────
      cart.clearCart();

      // ── Step 5: Build receipt data and show receipt modal ────────────────────
      const receipt: ReceiptData = {
        receiptNumber,
        shopName: shop.business_name,
        shopLocation: shop.location,
        shopPhone: null,
        items: saleItems.map((si) => ({
          name: si.productName,
          quantity: si.quantity,
          unitPrice: si.unitPrice,
          total: si.total,
        })),
        subtotal,
        discountAmount: 0,
        totalAmount: total,
        amountPaid: cart.amountPaid,
        changeAmount: change,
        paymentMethod: cart.paymentMethod,
        mpesaReference: cart.mpesaReference,
        cashierName: user.name,
        soldAt: salePayload.soldAt,
      };

      // Play cha-ching
      try {
        const audio = new Audio(CHACHING_URI);
        audio.volume = 0.5;
        void audio.play();
      } catch {
        // Audio unavailable — fail silently
      }

      setReceiptData(receipt);
      setShowReceipt(true);
      onClose();

      toast.success('Sale completed!', {
        description: `${receiptNumber} — KES ${total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
        icon: '✅',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sale failed.';
      toast.error('Sale failed', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNewSale = () => {
    setShowReceipt(false);
    setReceiptData(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Confirm Sale
            </DialogTitle>
          </DialogHeader>

          {/* Summary */}
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{cart.items.length} product{cart.items.length !== 1 ? 's' : ''} ({itemCount} units)</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>KES {subtotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
            </div>

            <Separator />

            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>KES {total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment method</span>
              <span className="capitalize font-medium">{cart.paymentMethod}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount paid</span>
              <span>KES {cart.amountPaid.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Change</span>
              <span className="text-emerald-600 font-semibold">
                KES {change.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              size="lg"
              onClick={() => void handleCompleteSale()}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Complete Sale</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt modal shown after successful sale */}
      <ReceiptModal
        open={showReceipt}
        data={receiptData}
        onNewSale={handleNewSale}
      />
    </>
  );
}
