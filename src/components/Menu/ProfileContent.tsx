"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, http, type Address } from "viem";
import { CheckCircle, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { useActiveChain } from "@/hooks/useActiveChain";
import { QRIS_REGISTRY_ABI } from "@/config/abi";
import { buildCurrencies } from "@/components/Currency";
import { parseQrisPayload, type QrisParseResult } from "@/lib/qris";
import Modal from "@/components/Modal";
import ClosedCamera from "@/components/ScanQRCode/ClosedCamera";
import OpenCamera from "@/components/ScanQRCode/OpenCamera";
import ImportFromGallery from "@/components/ScanQRCode/ImportFromGallery";

type QrisInfo = {
  qrisHash: string;
  sa: string;
  qrisPayload: string;
  merchantName: string;
  merchantId: string;
  merchantCity: string;
  active: boolean;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function ProfileContent() {
  const { config } = useActiveChain();
  const {
    smartAccountAddress,
    isReady,
    registerQris,
    removeMyQris,
    isLoading,
    status,
  } = useSmartAccount();
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      }),
    [config],
  );

  const currencies = useMemo(() => buildCurrencies(config), [config]);
  const defaultGasToken =
    currencies.find(
      (c) =>
        c.symbol.toLowerCase() === config.defaultTokenSymbol.toLowerCase(),
    ) || currencies[0];

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [parsedQris, setParsedQris] = useState<QrisParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [qrisInfo, setQrisInfo] = useState<QrisInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const [successModal, setSuccessModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: "", message: "" });

  const handleParsed = useCallback((payload: string) => {
    try {
      const parsed = parseQrisPayload(payload);
      if (!parsed.merchantName || !parsed.merchantId) {
        throw new Error("QRIS merchant name/ID not found");
      }
      setParsedQris(parsed);
      setParseError(null);
      setIsCameraOpen(false);
      setIsConfirmOpen(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid QRIS payload";
      setParsedQris(null);
      setParseError(message);
      setErrorModal({
        isOpen: true,
        title: "Invalid QRIS",
        message,
      });
    }
  }, []);

  const handleScanNow = () => {
    setIsCameraOpen(true);
  };

  const handleBack = () => {
    setIsCameraOpen(false);
  };

  const loadRegistryInfo = useCallback(async () => {
    if (!smartAccountAddress) {
      setQrisInfo(null);
      return;
    }

    setIsLoadingInfo(true);
    try {
      const info = (await publicClient.readContract({
        address: config.qrisRegistryAddress,
        abi: QRIS_REGISTRY_ABI,
        functionName: "getQrisBySa",
        args: [smartAccountAddress],
      })) as QrisInfo;

      setQrisInfo(info);
    } catch (err) {
      console.error("Failed to load QRIS registry:", err);
      setQrisInfo(null);
    } finally {
      setIsLoadingInfo(false);
    }
  }, [publicClient, smartAccountAddress, config.qrisRegistryAddress]);

  useEffect(() => {
    loadRegistryInfo();
  }, [loadRegistryInfo]);

  const isRegistered = Boolean(qrisInfo?.active && qrisInfo.sa !== ZERO_ADDRESS);

  const canRegister =
    !!smartAccountAddress &&
    !isRegistered &&
    !!parsedQris &&
    !parseError;

  const handleRegister = async () => {
    if (!parsedQris || !smartAccountAddress) return;

    setIsRegistering(true);
    try {
      await registerQris({
        qrisHash: parsedQris.hash,
        qrisPayload: parsedQris.raw,
        merchantName: parsedQris.merchantName,
        merchantId: parsedQris.merchantId,
        merchantCity: parsedQris.merchantCity,
        feeToken: defaultGasToken.tokenAddress as Address,
        feeTokenDecimals: defaultGasToken.decimals,
      });
      setSuccessModal({
        title: "QRIS Registered",
        message: "QRIS has been registered successfully.",
      });
      await loadRegistryInfo();
    } catch (err) {
      setErrorModal({
        isOpen: true,
        title: "QRIS Registration Failed",
        message:
          err instanceof Error ? err.message : "Failed to register QRIS",
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleConfirmCancel = () => {
    setIsConfirmOpen(false);
    setParsedQris(null);
    setParseError(null);
  };

  const handleConfirmRegister = async () => {
    setIsConfirmOpen(false);
    await handleRegister();
  };

  const handleRemove = async () => {
    if (!smartAccountAddress || !isRegistered) return;

    setIsRemoving(true);
    try {
      await removeMyQris({
        feeToken: defaultGasToken.tokenAddress as Address,
        feeTokenDecimals: defaultGasToken.decimals,
      });
      setSuccessModal({
        title: "QRIS Removed",
        message: "QRIS has been removed successfully.",
      });
      setParsedQris(null);
      setParseError(null);
      await loadRegistryInfo();
    } catch (err) {
      setErrorModal({
        isOpen: true,
        title: "QRIS Removal Failed",
        message: err instanceof Error ? err.message : "Failed to remove QRIS",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-3">
        <h2 className="text-sm font-semibold text-white">Smart Account</h2>
        {isReady && !smartAccountAddress && (
          <div className="p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-400 text-sm text-center">
            Connect wallet to view Smart Account
          </div>
        )}
        <div className="text-xs text-zinc-400">Address</div>
        <div className="p-3 bg-zinc-800/60 rounded-xl border border-zinc-700 font-mono text-xs text-zinc-200 break-all">
          {smartAccountAddress || "-"}
        </div>
      </div>

      {isRegistered && (
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Registered QRIS</h3>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isRemoving || isLoading}
              className="px-3 py-1.5 text-[11px] rounded-full border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRemoving || isLoading ? "Removing..." : "Remove QRIS"}
            </button>
          </div>
          {isLoadingInfo ? (
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading registry...
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl">
                  <QRCodeSVG
                    value={qrisInfo?.qrisPayload || ""}
                    size={140}
                    className="sm:w-[170px] sm:h-[170px]"
                  />
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <InfoRow
                  label="Merchant"
                  value={qrisInfo?.merchantName || "-"}
                />
                <InfoRow
                  label="Merchant ID"
                  value={qrisInfo?.merchantId || "-"}
                />
                <InfoRow label="City" value={qrisInfo?.merchantCity || "-"} />
              </div>
            </div>
          )}
        </div>
      )}

      {!isRegistered && (
        <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Register QRIS</h3>
          </div>

          {isCameraOpen ? (
            <OpenCamera
              onScan={handleParsed}
              onBack={handleBack}
              onError={(err) =>
                setErrorModal({
                  isOpen: true,
                  title: "Camera Error",
                  message: err.message,
                })
              }
            />
          ) : (
            <div className="space-y-3">
              <ClosedCamera onScanNow={handleScanNow} disabled={isRegistered} />
              <p className="text-accent text-sm text-center">or</p>
              <ImportFromGallery
                onImport={handleParsed}
                disabled={isRegistered}
                onError={(err) =>
                  setErrorModal({
                    isOpen: true,
                    title: "Import Failed",
                    message: err,
                  })
                }
              />
              {parseError && (
                <div className="text-xs text-red-400 text-center">
                  {parseError}
                </div>
              )}
            </div>
          )}

          {parsedQris && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <PreviewCard
                label="Merchant name"
                value={parsedQris.merchantName}
              />
              <PreviewCard
                label="Merchant ID"
                value={parsedQris.merchantId}
              />
              <PreviewCard
                label="Merchant city"
                value={parsedQris.merchantCity}
              />
            </div>
          )}
      </div>
      )}

      <Modal
        id="qris-register-success"
        role="dialog"
        aria-modal={true}
        aria-labelledby="qris-success-title"
        aria-describedby="qris-success-desc"
        tabIndex={-1}
        isOpen={!!successModal}
        onClose={() => setSuccessModal(null)}
        title={successModal?.title}
        message={successModal?.message}
        variant="success"
        icon={<CheckCircle className="w-8 h-8 text-emerald-400" />}
      />

      <Modal
        id="qris-confirm-modal"
        role="dialog"
        aria-modal={true}
        aria-labelledby="qris-confirm-title"
        aria-describedby="qris-confirm-desc"
        tabIndex={-1}
        isOpen={isConfirmOpen && !!parsedQris}
        onClose={handleConfirmCancel}
        title="Confirm QRIS"
        message="Please confirm the QRIS details before registering."
        variant="success"
        icon={<CheckCircle className="w-8 h-8 text-emerald-400" />}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <PreviewCard
              label="Merchant name"
              value={parsedQris?.merchantName}
            />
            <PreviewCard label="Merchant ID" value={parsedQris?.merchantId} />
            <PreviewCard
              label="Merchant city"
              value={parsedQris?.merchantCity}
            />
          </div>
          {canRegister && (
            <button
              type="button"
              onClick={handleConfirmRegister}
              disabled={isRegistering || isLoading}
              className="w-full py-3 bg-primary text-black font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegistering || isLoading ? "REGISTERING..." : "CONFIRM REGISTER"}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirmCancel}
            className="w-full py-2.5 border border-zinc-600 text-zinc-200 text-sm rounded-xl hover:bg-zinc-700/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      </Modal>

      <Modal
        id="qris-register-error"
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

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-zinc-400">{label}</span>
      <span
        className={`text-white text-right ${mono ? "font-mono break-all" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function PreviewCard({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="p-3 bg-zinc-800/60 border border-zinc-700 rounded-xl space-y-1">
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div
        className={`text-xs text-zinc-100 ${
          mono ? "font-mono break-all whitespace-normal text-[10px]" : ""
        }`}
      >
        {value || "-"}
      </div>
    </div>
  );
}
