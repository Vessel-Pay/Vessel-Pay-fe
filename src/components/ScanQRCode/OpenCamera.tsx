"use client";

import { useCallback } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface OpenCameraProps {
  onScan: (result: string) => void;
  onBack: () => void;
  onError?: (error: Error) => void;
}

export default function OpenCamera({ onScan, onBack, onError }: OpenCameraProps) {
  const handleScan = useCallback((result: any) => {
    if (result && result[0]?.rawValue) {
      onScan(result[0].rawValue);
    }
  }, [onScan]);

  const handleError = useCallback((error: unknown) => {
    console.error("QR Scanner Error:", error);
    if (error instanceof Error) {
      onError?.(error);
    }
  }, [onError]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Camera View */}
      <div className="w-full max-w-sm rounded-xl overflow-hidden relative">
        <Scanner
          onScan={handleScan}
          onError={handleError}
          constraints={{ facingMode: "environment" }}
          styles={{ container: { borderRadius: '0.75rem' } }}
        />
        {/* Scan Frame Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-8 border-2 border-primary rounded-lg" />
        </div>
      </div>
      {/* Back Button */}
      <button
        onClick={onBack}
        className="w-full max-w-sm py-4 border-2 border-accent text-white font-bold text-xl rounded-xl hover:bg-accent/10 transition-colors cursor-pointer"
      >
        BACK
      </button>
    </div>
  );
}
