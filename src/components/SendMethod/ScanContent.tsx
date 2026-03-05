"use client";

import { QRCode } from "@/components/ScanQRCode";
import { useSmartAccount } from "@/hooks/useSmartAccount";

export default function ScanContent() {
  const handleScanResult = (result: string) => {
    console.log("Scanned address:", result);
    // TODO: Handle the scanned result
  };

  const { smartAccountAddress, isReady } = useSmartAccount();
  const isDisabled = !smartAccountAddress;

  return (
    <div className="flex flex-col gap-y-2">
      {isReady && !smartAccountAddress && (
        <div className="p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-400 text-sm text-center">
          Connect wallet to send tokens
        </div>
      )}
      <QRCode onScanResult={handleScanResult} disabled={isDisabled} />
    </div>
  );
}
