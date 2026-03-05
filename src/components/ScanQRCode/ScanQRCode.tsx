"use client";
import { useState, useEffect, useMemo } from "react";
import ClosedCamera from "./ClosedCamera";
import OpenCamera from "./OpenCamera";
import ImportFromGallery from "./ImportFromGallery";
import TransactionPopup from "./TransactionPopup";
import QrisPaymentPopup from "./QrisPaymentPopup";
import { useActiveChain } from "@/hooks/useActiveChain";
import { ReceiptPopUp, ReceiptData } from "@/components/ReceiptPopUp";
import Modal from "@/components/Modal";
import { parseQrisPayload } from "@/lib/qris";
import { QRIS_REGISTRY_ABI } from "@/config/abi";
import { createPublicClient, http } from "viem";

interface PaymentRequestPayload {
  version: string;
  processor: string;
  chainId: number;
  request: {
    recipient: string;
    requestedToken: string;
    requestedAmountRaw: string;
    deadline: number;
    nonce: string;
    merchantSigner: string;
  };
  signature: string;
}

interface QrisRegistryInfo {
  qrisHash: string;
  sa: string;
  qrisPayload: string;
  merchantName: string;
  merchantId: string;
  merchantCity: string;
  active: boolean;
}

interface QRCodeProps {
  onScanResult?: (result: string) => void;
  disabled?: boolean;
}

export default function QRCode({ onScanResult, disabled }: QRCodeProps) {
  const { config } = useActiveChain();
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      }),
    [config],
  );
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [scannedPayload, setScannedPayload] =
    useState<PaymentRequestPayload | null>(null);
  const [scannedQris, setScannedQris] = useState<QrisRegistryInfo | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: "", message: "" });

  const handleScanNow = () => {
    if (disabled) {
      return;
    }
    setIsCameraOpen(true);
    setImportError(null);
  };

  const handleBack = () => {
    setIsCameraOpen(false);
  };

  const processQRData = async (result: string) => {
    setImportError(null);

    try {
      const data = JSON.parse(result);
      if (data?.version === "vessel-payment-v2") {
        if (
          !data.request?.requestedToken ||
          !data.request?.recipient ||
          !data.signature
        ) {
          throw new Error("QR data incomplete");
        }

        if (data.chainId !== config.chain.id) {
          throw new Error(
            `Wrong network. Expected ${config.chain.name} (${config.chain.id})`,
          );
        }

        if (
          data.request.deadline &&
          data.request.deadline < Math.floor(Date.now() / 1000)
        ) {
          throw new Error("Payment request has expired");
        }

        const payload: PaymentRequestPayload = {
          version: data.version,
          processor: data.processor || config.paymentProcessorAddress,
          chainId: data.chainId,
          request: {
            recipient: data.request.recipient,
            requestedToken: data.request.requestedToken,
            requestedAmountRaw: data.request.requestedAmountRaw,
            deadline: data.request.deadline,
            nonce: data.request.nonce,
            merchantSigner: data.request.merchantSigner,
          },
          signature: data.signature,
        };

        setScannedPayload(payload);
        setIsCameraOpen(false);
        onScanResult?.(result);
        return;
      }
    } catch {
      // fallthrough to QRIS
    }

    try {
      const parsed = parseQrisPayload(result);
      const info = (await publicClient.readContract({
        address: config.qrisRegistryAddress,
        abi: QRIS_REGISTRY_ABI,
        functionName: "getQris",
        args: [parsed.hash],
      })) as QrisRegistryInfo;

      if (!info || !info.active || info.sa === ZERO_ADDRESS) {
        throw new Error("QRIS not registered in Vessel Pay");
      }

      setScannedQris({
        ...info,
        qrisHash: parsed.hash,
      });
      setIsCameraOpen(false);
      onScanResult?.(result);
    } catch (e) {
      console.error("Invalid QR data:", e);
      setImportError(e instanceof Error ? e.message : "Invalid QR Code format");
      setErrorModal({
        isOpen: true,
        title: "Invalid QR Code",
        message: e instanceof Error ? e.message : "Invalid QR Code format",
      });
    }
  };

  const handleScan = (result: string) => {
    void processQRData(result);
  };

  const handleImport = (result: string) => {
    void processQRData(result);
  };

  const handleImportError = (error: string) => {
    setImportError(error);
  };

  const handleCancel = () => {
    setScannedPayload(null);
    setScannedQris(null);
  };

  useEffect(() => {
    if (disabled && isCameraOpen) {
      setIsCameraOpen(false);
    }
  }, [disabled, isCameraOpen]);

  if (scannedPayload) {
    return (
      <TransactionPopup payload={scannedPayload} onCancel={handleCancel} />
    );
  }

  if (scannedQris) {
    return (
      <QrisPaymentPopup
        recipient={scannedQris.sa}
        merchantName={scannedQris.merchantName}
        merchantId={scannedQris.merchantId}
        merchantCity={scannedQris.merchantCity}
        qrisHash={scannedQris.qrisHash}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {isCameraOpen && !disabled ? (
        <OpenCamera onScan={handleScan} onBack={handleBack} />
      ) : (
        <>
          <ClosedCamera onScanNow={handleScanNow} disabled={disabled} />

          <p className="text-accent text-sm">or</p>

          <ImportFromGallery
            onImport={handleImport}
            onError={handleImportError}
            disabled={disabled}
          />
        </>
      )}
      <ReceiptPopUp
        isOpen={showReceipt}
        data={receipt}
        onClose={() => setShowReceipt(false)}
      />

      {/* Error Modal */}
      <Modal
        id="scan-error-modal"
        className="modal-alert"
        role="alertdialog"
        aria-modal={true}
        aria-labelledby="alert-title"
        aria-describedby="alert-desc"
        tabIndex={-1}
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
}
