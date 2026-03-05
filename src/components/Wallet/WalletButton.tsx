"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { Wallet, LogOut, Loader2, Copy, Check } from "lucide-react";
import Modal from "@/components/Modal";

export default function WalletButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const {
    smartAccountAddress,
    eoaAddress,
    status,
    isLoading,
    initSmartAccount,
  } = useSmartAccount();
  const [copied, setCopied] = useState(false);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  const handleConnect = async () => {
    if (!authenticated) {
      login();
    } else if (!smartAccountAddress) {
      try {
        await initSmartAccount();
      } catch (err) {
        console.error("Failed to init smart account", err);
        setErrorModal({
          isOpen: true,
          title: "Wallet Error",
          message: err instanceof Error ? err.message : "Failed to initialize wallet",
          onRetry: handleConnect,
        });
      }
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleCopyAddress = async () => {
    const addr = smartAccountAddress || eoaAddress;
    if (!addr) return;

    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  if (!ready) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-xl text-zinc-500 text-sm"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="hidden sm:inline">Loading...</span>
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 px-3 py-2 bg-primary text-black font-semibold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer text-sm"
      >
        <Wallet className="w-4 h-4" />
        <span className="hidden xs:inline">Connect</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Address Display */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 rounded-lg">
        {smartAccountAddress ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <button
              onClick={handleCopyAddress}
              className="text-white font-mono text-xs hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
              title="Click to copy"
            >
              {formatAddress(smartAccountAddress)}
              {copied ? (
                <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-500 flex-shrink-0" />
              )}
            </button>
          </>
        ) : eoaAddress ? (
          <>
            <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
            <span className="text-zinc-400 font-mono text-xs">
              {formatAddress(eoaAddress)}
            </span>
          </>
        ) : (
          <>
            <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
            <span className="text-zinc-400 text-xs">Init...</span>
          </>
        )}
      </div>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors cursor-pointer text-zinc-400 hover:text-white flex-shrink-0"
        title="Logout"
      >
        <LogOut className="w-4 h-4" />
      </button>

      {/* Error Modal */}
      <Modal
        id="wallet-error-modal"
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
      >
        {errorModal.onRetry && (
          <button
            onClick={() => {
              errorModal.onRetry?.();
              setErrorModal({ ...errorModal, isOpen: false });
            }}
            className="w-full py-4 bg-primary text-black font-bold text-lg rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
          >
            RETRY
          </button>
        )}
      </Modal>
    </div>
  );
}
