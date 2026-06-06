'use client';

// src/components/pos/payment-mixed.tsx
// Purpose: Mixed payment — split amount across Cash, M-Pesa, and Bank.

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PaymentSplit } from '@/types/pos';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentMixedProps {
  total: number;
  split: PaymentSplit;
  onSplitChange: (partial: Partial<PaymentSplit>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentMixed({ total, split, onSplitChange }: PaymentMixedProps) {
  const totalPaid = split.cash + split.mpesa + split.bank;
  const shortfall = total - totalPaid;
  const isPaid = totalPaid >= total;

  const handleChange = (field: keyof PaymentSplit, raw: string) => {
    const n = parseFloat(raw);
    onSplitChange({ [field]: isNaN(n) ? 0 : n });
  };

  return (
    <div className="space-y-4">
      {/* Split inputs */}
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            { key: 'cash', label: 'Cash' },
            { key: 'mpesa', label: 'M-Pesa' },
            { key: 'bank', label: 'Bank' },
          ] as const
        ).map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`mixed-${key}`} className="text-xs font-medium">
              {label} (KES)
            </Label>
            <Input
              id={`mixed-${key}`}
              type="number"
              min={0}
              step={1}
              placeholder="0"
              value={split[key] > 0 ? split[key] : ''}
              onChange={(e) => handleChange(key, e.target.value)}
              className="font-mono text-sm text-center"
            />
          </div>
        ))}
      </div>

      {/* Running total */}
      <div
        className={cn(
          'rounded-xl px-5 py-4 text-center transition-colors',
          isPaid
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : 'bg-muted border border-border',
        )}
      >
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Total collected</span>
          <span className="font-mono font-semibold text-foreground">
            KES {totalPaid.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {isPaid ? (
          <p className="text-emerald-500 font-semibold text-sm">✓ Payment complete</p>
        ) : (
          <p className="text-destructive font-semibold text-sm">
            Shortfall: KES {shortfall.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>
    </div>
  );
}
