'use client';

// src/components/pos/receipt-modal.tsx
// Purpose: Post-sale receipt modal — shows receipt, print button, WhatsApp share.

import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, MessageCircle, ShoppingCart } from 'lucide-react';
import { ReceiptPrint } from '@/components/pos/receipt-print';
import type { ReceiptData } from '@/types/pos';

// ─── WhatsApp text builder ─────────────────────────────────────────────────────

function buildWhatsAppText(data: ReceiptData): string {
  const date = new Date(data.soldAt).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const lines: string[] = [
    `*RECEIPT — ${data.shopName}*`,
    '─────────────────────',
    `Receipt: ${data.receiptNumber}`,
    `Date: ${date}`,
    '',
  ];

  data.items.forEach((item) => {
    const name = item.name.padEnd(18, ' ').slice(0, 18);
    const qty = `× ${item.quantity}`;
    const total = `KES ${item.total.toLocaleString('en-KE')}`;
    lines.push(`${name}${qty.padStart(4, ' ')}    ${total}`);
  });

  lines.push(
    '─────────────────────',
    `*TOTAL: KES ${data.totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}*`,
    `Paid (${data.paymentMethod}): KES ${data.amountPaid.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
    `Change: KES ${data.changeAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`,
    '',
    'Thank you! 🙏',
  );

  return lines.join('\n');
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReceiptModalProps {
  open: boolean;
  data: ReceiptData | null;
  onNewSale: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReceiptModal({ open, data, onNewSale }: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${data?.receiptNumber ?? 'sale'}`,
  });

  const handleWhatsApp = () => {
    if (!data) return;
    const text = buildWhatsAppText(data);
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onNewSale(); }}>
      <DialogContent className="max-w-sm sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="text-center text-lg font-bold">
            Sale Complete 🎉
          </DialogTitle>
          <p className="text-center text-sm text-muted-foreground">
            {data.receiptNumber}
          </p>
        </DialogHeader>

        {/* Receipt preview */}
        <ScrollArea className="max-h-[55vh]">
          <div className="flex justify-center py-4 bg-muted/30">
            <div className="shadow-md rounded-sm overflow-hidden border border-border">
              <ReceiptPrint ref={receiptRef} data={data} />
            </div>
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="p-4 border-t space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => handlePrint()}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={handleWhatsApp}
              className="gap-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={onNewSale}
          >
            <ShoppingCart className="h-4 w-4" />
            New Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
