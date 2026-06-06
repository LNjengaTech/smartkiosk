'use client';

// src/components/pos/payment-cash.tsx
// Purpose: Cash payment input — amount tendered and change calculation.

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentCashProps {
  total: number;
  amountPaid: number;
  onAmountChange: (n: number) => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getPresets(total: number): number[] {
  const candidates = [50, 100, 200, 500, 1000, 2000, 5000];
  return candidates.filter((p) => p >= total);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentCash({ total, amountPaid, onAmountChange }: PaymentCashProps) {
  const change = amountPaid - total;
  const shortfall = total - amountPaid;
  const isPaid = amountPaid >= total;
  const presets = getPresets(total);

  const handleInput = (raw: string) => {
    const n = parseFloat(raw);
    onAmountChange(isNaN(n) ? 0 : n);
  };

  return (
    <div className="space-y-4">
      {/* Amount input */}
      <div className="space-y-1.5">
        <Label htmlFor="cash-amount" className="text-sm font-medium">
          Amount received (KES)
        </Label>
        <Input
          id="cash-amount"
          type="number"
          min={0}
          step={1}
          placeholder="0.00"
          value={amountPaid > 0 ? amountPaid : ''}
          onChange={(e) => handleInput(e.target.value)}
          className="text-2xl h-14 font-mono tracking-wider text-center"
          autoFocus
        />
      </div>

      {/* Quick preset buttons */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.slice(0, 5).map((p) => (
            <Button
              key={p}
              variant={amountPaid === p ? 'default' : 'outline'}
              size="sm"
              className="flex-1 min-w-[60px] font-mono text-xs"
              onClick={() => onAmountChange(p)}
            >
              {p.toLocaleString()}
            </Button>
          ))}
        </div>
      )}

      {/* Change / shortfall display */}
      {amountPaid > 0 && (
        <div
          className={cn(
            'rounded-xl px-5 py-4 text-center transition-colors',
            isPaid
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-destructive/10 border border-destructive/30',
          )}
        >
          {isPaid ? (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Change due</p>
              <p className="text-3xl font-bold font-mono text-emerald-500">
                KES {change.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Short by</p>
              <p className="text-3xl font-bold font-mono text-destructive">
                KES {shortfall.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
