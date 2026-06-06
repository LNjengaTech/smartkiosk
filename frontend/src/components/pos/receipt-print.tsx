'use client';

// src/components/pos/receipt-print.tsx
// Purpose: 80mm thermal-printer-optimised receipt layout. Used for both screen
//          preview and print output.

import { forwardRef } from 'react';
import type { ReceiptData } from '@/types/pos';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReceiptPrintProps {
  data: ReceiptData;
}

// ─── Print styles (injected via style tag) ────────────────────────────────────

const PRINT_STYLE = `
@media print {
  body > * { display: none !important; }
  body > #receipt-print-root { display: block !important; }
  .no-print { display: none !important; }
  @page { size: 80mm auto; margin: 0; }
  body { margin: 0; padding: 0; }
}
`;

// ─── Component (forwarded ref so react-to-print can target it) ────────────────

export const ReceiptPrint = forwardRef<HTMLDivElement, ReceiptPrintProps>(
  ({ data }, ref) => {
    const date = new Date(data.soldAt).toLocaleString('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: PRINT_STYLE }} />
        <div
          ref={ref}
          id="receipt-print-root"
          className="font-mono text-[11px] leading-snug text-black bg-white"
          style={{ width: 320, padding: '12px 8px' }}
        >
          {/* Shop header */}
          <div className="text-center mb-2">
            <p className="font-bold text-[13px] uppercase tracking-wider">{data.shopName}</p>
            {data.shopLocation && (
              <p className="text-[10px] text-gray-600">{data.shopLocation}</p>
            )}
            {data.shopPhone && (
              <p className="text-[10px] text-gray-600">Tel: {data.shopPhone}</p>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Receipt metadata */}
          <div className="space-y-0.5 mb-2">
            <ReceiptRow label="Receipt" value={data.receiptNumber} />
            <ReceiptRow label="Date" value={date} />
            <ReceiptRow label="Cashier" value={data.cashierName} />
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Items */}
          <div className="space-y-1 mb-2">
            {data.items.map((item, i) => (
              <div key={i}>
                <p className="truncate">{item.name}</p>
                <div className="flex justify-between pl-2 text-gray-700">
                  <span>
                    {item.quantity} × {item.unitPrice.toLocaleString('en-KE')}
                  </span>
                  <span className="font-semibold">
                    {item.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Totals */}
          <div className="space-y-0.5 mb-2">
            {data.discountAmount > 0 && (
              <ReceiptRow
                label="Subtotal"
                value={`KES ${data.subtotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`}
              />
            )}
            {data.discountAmount > 0 && (
              <ReceiptRow
                label="Discount"
                value={`-KES ${data.discountAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`}
              />
            )}
            <div className="flex justify-between font-bold text-[13px] mt-1">
              <span>TOTAL</span>
              <span>KES {data.totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Payment details */}
          <div className="space-y-0.5 mb-2">
            <ReceiptRow
              label="Payment"
              value={data.paymentMethod.charAt(0).toUpperCase() + data.paymentMethod.slice(1)}
            />
            <ReceiptRow
              label="Paid"
              value={`KES ${data.amountPaid.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`}
            />
            <ReceiptRow
              label="Change"
              value={`KES ${data.changeAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`}
            />
            {data.mpesaReference && (
              <ReceiptRow label="M-Pesa Ref" value={data.mpesaReference} />
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Footer */}
          <div className="text-center space-y-0.5">
            <p className="font-semibold">Thank you for your business!</p>
            <p className="text-[9px] text-gray-500">Powered by SmartKiosk</p>
          </div>
        </div>
      </>
    );
  },
);

ReceiptPrint.displayName = 'ReceiptPrint';

// ─── Sub-component ────────────────────────────────────────────────────────────

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}:</span>
      <span>{value}</span>
    </div>
  );
}
