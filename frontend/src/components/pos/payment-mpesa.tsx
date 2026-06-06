'use client';

// src/components/pos/payment-mpesa.tsx
// Purpose: M-Pesa payment input — STK Push trigger and reference confirmation.

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentMpesaProps {
  total: number;
  onReferenceChange: (ref: string) => void;
}

type StkStatus = 'idle' | 'pending' | 'success' | 'failed' | 'timeout';

// ─── Phone normalisation ───────────────────────────────────────────────────────

function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('254') && digits.length === 12) return digits;
  return digits;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentMpesa({ total, onReferenceChange }: PaymentMpesaProps) {
  const [phone, setPhone] = useState('');
  const [reference, setReference] = useState('');
  const [stkStatus, setStkStatus] = useState<StkStatus>('idle');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  // ── Poll M-Pesa status ───────────────────────────────────────────────────────

  useEffect(() => {
    if (stkStatus !== 'pending' || !checkoutRequestId) return;

    pollCountRef.current = 0;
    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      if (pollCountRef.current > 20) {
        // 60s timeout (20 × 3s)
        clearInterval(pollRef.current!);
        setStkStatus('timeout');
        setStatusMessage('Request expired. Ask customer to enter M-Pesa code manually.');
        return;
      }

      try {
        const apiClient = (await import('@/lib/api/client')).default;
        const res = await apiClient.get<{
          success: boolean;
          data: { status: string; mpesaReceiptNumber?: string };
        }>(`/payments/mpesa/status/${checkoutRequestId}`);

        const { status, mpesaReceiptNumber } = res.data.data;

        if (status === 'success' && mpesaReceiptNumber) {
          clearInterval(pollRef.current!);
          setStkStatus('success');
          setStatusMessage('Payment confirmed ✓');
          setReference(mpesaReceiptNumber);
          onReferenceChange(mpesaReceiptNumber);
        } else if (status === 'failed') {
          clearInterval(pollRef.current!);
          setStkStatus('failed');
          setStatusMessage('Payment declined. Ask customer to retry or enter code manually.');
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stkStatus, checkoutRequestId, onReferenceChange]);

  // ── Send STK Push ─────────────────────────────────────────────────────────────

  const handleSendRequest = async () => {
    const normalised = normalisePhone(phone);
    if (normalised.length < 12) {
      setStatusMessage('Enter a valid Kenyan phone number (e.g. 0712 345 678).');
      return;
    }

    setStkStatus('pending');
    setStatusMessage('Sending payment request to customer\'s phone…');

    try {
      const apiClient = (await import('@/lib/api/client')).default;
      const res = await apiClient.post<{
        success: boolean;
        data: { checkoutRequestId: string; message: string };
      }>('/payments/mpesa/stk-push', {
        phone: normalised,
        amount: Math.ceil(total),
        account_reference: 'SmartKiosk Sale',
      });

      setCheckoutRequestId(res.data.data.checkoutRequestId);
      setStatusMessage(res.data.data.message);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'STK Push failed.';
      setStkStatus('failed');
      setStatusMessage(`Failed to send request: ${message}`);
    }
  };

  const handleReferenceChange = (val: string) => {
    setReference(val);
    onReferenceChange(val);
  };

  return (
    <div className="space-y-4">
      {/* Phone input + send button */}
      <div className="space-y-1.5">
        <Label htmlFor="mpesa-phone" className="text-sm font-medium">
          Customer phone number
        </Label>
        <div className="flex gap-2">
          <Input
            id="mpesa-phone"
            type="tel"
            placeholder="0712 345 678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="flex-1"
            disabled={stkStatus === 'pending'}
          />
          <Button
            onClick={() => void handleSendRequest()}
            disabled={stkStatus === 'pending' || !phone.trim()}
            className="gap-2 shrink-0"
          >
            {stkStatus === 'pending' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            {stkStatus === 'pending' ? 'Sending…' : 'Send Request'}
          </Button>
        </div>
      </div>

      {/* Status display */}
      {statusMessage && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg px-4 py-3 text-sm',
            stkStatus === 'success' && 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600',
            stkStatus === 'pending' && 'bg-blue-500/10 border border-blue-500/30 text-blue-600',
            (stkStatus === 'failed' || stkStatus === 'timeout') && 'bg-amber-500/10 border border-amber-500/30 text-amber-600',
          )}
        >
          {stkStatus === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
          {stkStatus === 'pending' && <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin" />}
          {(stkStatus === 'failed' || stkStatus === 'timeout') && <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
          {statusMessage}
        </div>
      )}

      {/* Manual reference input — always visible */}
      <div className="space-y-1.5">
        <Label htmlFor="mpesa-ref" className="text-sm font-medium">
          M-Pesa confirmation code
        </Label>
        <Input
          id="mpesa-ref"
          type="text"
          placeholder="e.g. QDK3XVBN72"
          value={reference}
          onChange={(e) => handleReferenceChange(e.target.value.toUpperCase())}
          className="font-mono tracking-wider uppercase"
        />
        <p className="text-xs text-muted-foreground">
          Auto-filled on success, or enter manually from customer's SMS.
        </p>
      </div>
    </div>
  );
}
