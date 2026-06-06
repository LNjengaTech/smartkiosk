'use client';

// src/components/pos/payment-bank.tsx
// Purpose: Bank/EFT payment reference input.

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentBankProps {
  onReferenceChange: (ref: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentBank({ onReferenceChange }: PaymentBankProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="bank-ref" className="text-sm font-medium">
          Bank reference / transaction number
        </Label>
        <Input
          id="bank-ref"
          type="text"
          placeholder="e.g. TXN20260601001"
          className="font-mono tracking-wide"
          onChange={(e) => onReferenceChange(e.target.value)}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bank-name" className="text-sm font-medium">
          Bank name <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="bank-name"
          type="text"
          placeholder="e.g. KCB, Equity, NCBA…"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Enter the reference number from the bank slip or EFT confirmation.
      </p>
    </div>
  );
}
