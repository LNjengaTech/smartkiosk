// frontend/src/components/dashboard/barcode-scanner.tsx
// Purpose: Sleek camera viewfinder scanner built on html5-qrcode.
//          Handles permission errors gracefully and shows an animated target overlay.

'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'barcode-scanner-viewfinder';
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize and start scanner
  const startScanner = async () => {
    setIsInitializing(true);
    setHasPermission(null);

    // Stop existing scanner instance if it exists
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // Safe to ignore if not running
      }
      scannerRef.current = null;
    }

    try {
      const html5Qrcode = new Html5Qrcode(containerId);
      scannerRef.current = html5Qrcode;

      const devices = await Html5Qrcode.getCameras();
      if (devices.length === 0) {
        throw new Error('No camera found on this device.');
      }

      setHasPermission(true);
      setIsInitializing(false);

      // Start scanning using the back camera (or default)
      const config = {
        fps: 10,
        qrbox: { width: 280, height: 160 }, // optimized rectangle for barcodes
      };

      await html5Qrcode.start(
        { facingMode: 'environment' }, // force rear camera
        config,
        (decodedText) => {
          // Success callback
          toast.success(`Barcode detected: ${decodedText}`);
          onScan(decodedText);
          
          // Stop camera immediately on success
          if (scannerRef.current) {
            scannerRef.current.stop().then(() => onClose()).catch(() => onClose());
          } else {
            onClose();
          }
        },
        () => {
          // Silent scan failure (normal between frames)
        }
      );
    } catch (err: unknown) {
      console.error('[BarcodeScanner] error:', err);
      setHasPermission(false);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    // Start scanner on mount
    startScanner();

    return () => {
      // Stop scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center bg-zinc-950 text-white rounded-2xl overflow-hidden aspect-[4/3] w-full max-w-md border border-white/10 shadow-2xl">
      {/* Viewfinder element */}
      <div id={containerId} className="absolute inset-0 w-full h-full object-cover [&>video]:object-cover" />

      {/* Top Close Button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-colors"
        aria-label="Close scanner"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Laser Scanning Line Animation Overlay */}
      {hasPermission && !isInitializing && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
          {/* Target framing box */}
          <div className="relative w-[280px] h-[160px] border-2 border-primary/60 rounded-xl overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(228,72,52,0.15)] bg-black/5">
            {/* Scanning line animation */}
            <div className="absolute left-0 w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse-glow" style={{
              animation: 'scan-laser 2s linear infinite',
            }} />
            
            {/* Styling tag corners */}
            <span className="absolute top-2 left-2 text-xs text-primary/80 font-bold font-mono">SCAN</span>
          </div>

          <style>{`
            @keyframes scan-laser {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
          `}</style>
        </div>
      )}

      {/* Loading Overlay */}
      {isInitializing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 z-20 space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-zinc-300">Initializing camera...</p>
        </div>
      )}

      {/* Blocked / Error UI */}
      {hasPermission === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 z-20 p-6 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-lg">Camera Access Required</h4>
            <p className="text-sm text-zinc-400 max-w-xs">
              Please grant camera permissions to scan barcodes directly using your device.
            </p>
          </div>
          <Button type="button" onClick={startScanner} variant="outline" className="text-zinc-200 border-zinc-700 hover:bg-zinc-800">
            <Camera className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
