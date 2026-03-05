"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Share2, Copy, Check } from "lucide-react";
import { buildCurrencies } from "@/components/Currency";
import { formatUnits } from "viem";
import { useActiveChain } from "@/hooks/useActiveChain";

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

interface GeneratedQRCodeProps {
  data: PaymentRequestPayload;
  onBack: () => void;
}

export default function GeneratedQRCode({
  data,
  onBack,
}: GeneratedQRCodeProps) {
  const { config } = useActiveChain();
  const currencies = useMemo(() => buildCurrencies(config), [config]);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrValue = JSON.stringify(data);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });

  // Detect mobile device
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  // Show toast helper
  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3000,
    );
  };

  // Find currency info from token address
  const currency = currencies.find(
    (c) =>
      c.tokenAddress.toLowerCase() ===
      data.request.requestedToken.toLowerCase(),
  );

  const displayAmount = currency
    ? Number(
      formatUnits(BigInt(data.request.requestedAmountRaw), currency.decimals),
    ).toLocaleString(undefined, { maximumFractionDigits: 6 })
    : data.request.requestedAmountRaw;

  const symbol = currency?.symbol || "Token";

  // Calculate remaining time until deadline
  const deadlineMs = data.request.deadline * 1000;

  useEffect(() => {
    const updateRemaining = () => {
      const remaining =
        Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000)) || 0;
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        return true;
      }
      return false;
    };

    if (updateRemaining()) {
      onBack();
      return;
    }

    const intervalId = setInterval(() => {
      if (updateRemaining()) {
        clearInterval(intervalId);
        onBack();
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [deadlineMs, onBack]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const handleDownload = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    // Create canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with padding
    const size = 300;
    const padding = 30;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;

    // Fill white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      URL.revokeObjectURL(url);

      // Download
      const link = document.createElement("a");
      link.download = `vessel-qr-${displayAmount}-${symbol}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = url;
  };

  const handleShare = async () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    try {
      // Create canvas
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size with padding
      const size = 300;
      const padding = 30;
      canvas.width = size + padding * 2;
      canvas.height = size + padding * 2;

      // Fill white background
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Convert SVG to image
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = async () => {
        ctx.drawImage(img, padding, padding, size, size);
        URL.revokeObjectURL(url);

        // Convert canvas to blob
        canvas.toBlob(async (blob) => {
          if (!blob) return;

          const fileName = `vessel-qr-${displayAmount}-${symbol}.png`;

          // MOBILE: Use native share (better UX)
          if (isMobile && navigator.canShare) {
            const file = new File([blob], fileName, { type: "image/png" });

            if (navigator.canShare({ files: [file] })) {
              try {
                await navigator.share({
                  title: "Vessel Pay Payment QR",
                  text: `Scan to pay ${displayAmount} ${symbol}`,
                  files: [file],
                });
                return; // Success, exit early
              } catch (err) {
                if ((err as Error).name === "AbortError") {
                  return; // User cancelled, exit early
                }
                console.error("Share failed:", err);
                // Fall through to download
              }
            }
          }

          // DESKTOP: Copy to clipboard only
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            showToast("QR code copied!", "success");
          } catch (clipboardErr) {
            console.error("Clipboard copy failed:", clipboardErr);
            // Fallback: download if clipboard fails
            const link = document.createElement("a");
            link.download = fileName;
            link.href = canvas.toDataURL("image/png");
            link.click();
            showToast("QR code downloaded!", "success");
          }
        }, "image/png");
      };
      img.src = url;
    } catch (err) {
      console.error("Share error:", err);
      showToast("Failed to share QR code", "error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4">
      <div ref={qrRef} className="p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl">
        <QRCodeSVG value={qrValue} size={160} className="sm:w-[200px] sm:h-[200px]" />
      </div>
      <div className="text-center">
        <p className="text-white font-medium text-sm sm:text-base">Scan to pay</p>
        <p className="text-primary text-xl sm:text-2xl font-bold">
          {displayAmount} {symbol}
        </p>
        <p className="text-zinc-400 text-xs sm:text-sm mt-1 sm:mt-2">Expires in {formattedTime}</p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-sm">
        <button
          onClick={handleShare}
          className="w-full py-2.5 sm:py-3 bg-primary text-black font-bold text-sm sm:text-base md:text-lg rounded-xl hover:bg-primary/90 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          {isMobile ? (
            <>
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              SHARE QR
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
              COPY QR
            </>
          )}
        </button>
        <button
          onClick={handleDownload}
          className="w-full py-2.5 sm:py-3 bg-zinc-700 text-white font-bold text-sm sm:text-base md:text-lg rounded-xl hover:bg-zinc-600 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          SAVE QR
        </button>
        <button
          onClick={onBack}
          className="w-full py-2.5 sm:py-3 border border-accent text-white font-bold text-sm sm:text-base md:text-lg rounded-xl hover:bg-accent/10 transition-colors cursor-pointer"
        >
          CANCEL
        </button>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border ${toast.type === "success"
              ? "bg-zinc-900 border-primary/50 text-primary"
              : "bg-zinc-900 border-red-500/50 text-red-400"
              }`}
          >
            {toast.type === "success" ? (
              <Check className="w-5 h-5" />
            ) : (
              <span className="text-lg">⚠️</span>
            )}
            <span className="font-medium text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
