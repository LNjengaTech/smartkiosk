'use client';

// src/components/pos/smart-scan-modal.tsx
// Purpose: Camera barcode scanner modal using Html5-QRCode. Resolves the scanned
//          barcode to a product and adds it to the cart.

import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, CameraOff, Keyboard } from 'lucide-react';
import type { ProductResponse } from '@/types/api';

// ─── Tiny base64 beep sound (200ms 880Hz sine wave) ──────────────────────────

const BEEP_AUDIO_URI =
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWoGAACBhYqPk5ebn6OmqayvsLKztLW2t7i4uLi4t7a1tLKxr62rqKWioJ2amJWSkI2KiIWCf3x6d3RycG1raGZkYmBfXVtaWFdWVFNSUVBPTk1MTEtKSklJSEhHR0dHR0dHR0dHR0hISUlKSkpLS0xMTU5OT1BRUlNUVVZXWFlaW1xdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/wABAgMEBQYHCAkKCwwNDg8QERITFBUWFxgZGhscHR4fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fX5/gA==';

// ─── Supported barcode formats ─────────────────────────────────────────────────

const SUPPORTED_FORMATS = [
  'EAN_13', 'EAN_8', 'QR_CODE', 'CODE_128', 'CODE_39', 'UPC_A', 'UPC_E',
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SmartScanModalProps {
  open: boolean;
  onClose: () => void;
  onProductFound: (product: ProductResponse) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SmartScanModal({ open, onClose, onProductFound }: SmartScanModalProps) {
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const playBeep = useCallback(() => {
    try {
      const audio = new Audio(BEEP_AUDIO_URI);
      audio.volume = 0.4;
      void audio.play();
    } catch {
      // Audio unavailable — fail silently
    }
  }, []);

  const lookupBarcode = useCallback(async (barcode: string) => {
    setIsLookingUp(true);
    setError(null);

    try {
      // 1. Try IndexedDB first — instant local lookup
      const { db } = await import('@/lib/db/dexie');
      const localProduct = await db.products.where('barcode').equals(barcode).first();

      if (localProduct) {
        // Map LocalProduct → ProductResponse shape
        const product: ProductResponse = {
          id: String(localProduct.id ?? ''),
          uuid: localProduct.uuid,
          shopId: String(localProduct.shopId),
          categoryId: localProduct.categoryId ? String(localProduct.categoryId) : null,
          supplierId: localProduct.supplierId ? String(localProduct.supplierId) : null,
          name: localProduct.name,
          sku: localProduct.sku,
          barcode: localProduct.barcode,
          buyingPrice: localProduct.buyingPrice,
          sellingPrice: localProduct.sellingPrice,
          quantity: localProduct.quantity,
          reorderLevel: localProduct.reorderLevel,
          unit: localProduct.unit,
          expiryDate: localProduct.expiryDate,
          imageUrl: localProduct.imageUrl,
          isActive: localProduct.isActive,
          category: null,
          createdAt: '',
          updatedAt: '',
        };
        playBeep();
        onProductFound(product);
        onClose();
        return;
      }

      // 2. API fallback — only if online
      if (navigator.onLine) {
        const apiClient = (await import('@/lib/api/client')).default;
        const response = await apiClient.get<{ success: boolean; data: ProductResponse }>(
          `/products/barcode/${encodeURIComponent(barcode)}`,
        );
        if (response.data.success && response.data.data) {
          playBeep();
          onProductFound(response.data.data);
          onClose();
          return;
        }
      }

      setError(`Product not found for barcode "${barcode}". Try manual entry.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lookup failed.';
      setError(`Product not found: ${message}`);
    } finally {
      setIsLookingUp(false);
    }
  }, [onClose, onProductFound, playBeep]);

  // ── Start/Stop scanner ────────────────────────────────────────────────────────

  const startScanner = useCallback(async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      // Wait for the DOM element to exist
      await new Promise<void>((resolve) => setTimeout(resolve, 100));

      scannerRef.current = new Html5Qrcode('smartscan-reader');
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 200 },
          formatsToSupport: SUPPORTED_FORMATS as Parameters<typeof Html5Qrcode.prototype.start>[2]['formatsToSupport'],
        },
        async (decodedText) => {
          // Pause scanner while looking up
          await scannerRef.current?.pause();
          await lookupBarcode(decodedText);

          // Resume after 2s if error
          setTimeout(() => {
            if (scannerRef.current) {
              void scannerRef.current.resume();
            }
          }, 2000);
        },
        undefined,
      );
      setScanning(true);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera error';
      if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('denied')) {
        setError('Camera access denied. Please allow camera access or enter the barcode manually.');
      } else {
        setError(`Could not start camera: ${message}`);
      }
    }
  }, [lookupBarcode]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Already stopped
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      void startScanner();
    }
    return () => {
      void stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  const handleClose = async () => {
    await stopScanner();
    onClose();
  };

  const handleManualSubmit = async () => {
    if (!manualBarcode.trim()) return;
    await lookupBarcode(manualBarcode.trim());
    setManualBarcode('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) void handleClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Camera className="h-5 w-5 text-primary" />
            SmartScan
          </DialogTitle>
        </DialogHeader>

        {/* ── Viewfinder ──────────────────────────────────────────────────── */}
        <div className="relative mx-6 mt-4 rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
          {/* Scanner target element */}
          <div id="smartscan-reader" className="w-full h-full" />

          {/* Corner bracket overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative" style={{ width: 250, height: 200 }}>
              {/* Top-left */}
              <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-sm" />
              {/* Top-right */}
              <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-sm" />
              {/* Bottom-left */}
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-sm" />
              {/* Bottom-right */}
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-sm" />
              {/* Scan line animation */}
              {scanning && (
                <span
                  className="absolute left-2 right-2 h-0.5 bg-primary/80 animate-bounce"
                  style={{ top: '50%' }}
                />
              )}
            </div>
          </div>

          {/* Not scanning overlay */}
          {!scanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white text-sm gap-2">
              <CameraOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">Starting camera…</p>
            </div>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mx-6 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* ── Manual entry ──────────────────────────────────────────────────── */}
        <div className="px-6 pb-6 mt-4 space-y-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowManual((v) => !v)}
          >
            <Keyboard className="h-4 w-4" />
            {showManual ? 'Hide manual entry' : 'Enter barcode manually'}
          </Button>

          {showManual && (
            <div className="flex gap-2">
              <Input
                placeholder="Enter barcode…"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleManualSubmit(); }}
                autoFocus
              />
              <Button
                onClick={() => void handleManualSubmit()}
                disabled={isLookingUp || !manualBarcode.trim()}
              >
                {isLookingUp ? '…' : 'Find'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
