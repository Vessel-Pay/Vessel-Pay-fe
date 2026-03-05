"use client";

import { useState } from "react";
import { AlertCircle, Loader2, LogOut } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import type { BaseAppDeploymentStatus } from "@/hooks/useSmartAccount";
import { useActiveChain } from "@/hooks/useActiveChain";
import Modal from "@/components/Modal";

interface ActivationModalProps {
  onActivate: () => Promise<void>;
  status: string;
  baseAppDeployment: BaseAppDeploymentStatus | null;
  onDeployBase?: () => Promise<any>;
}

export default function ActivationModal({
  onActivate,
  status,
  baseAppDeployment,
  onDeployBase,
}: ActivationModalProps) {
  const { config } = useActiveChain();
  const tokens = config.tokens;
  const [isActivating, setIsActivating] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { logout } = usePrivy();
  const isBaseAppNotReady = baseAppDeployment?.status === "missing";

  // Error modal state for critical errors
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  const handleActivate = async () => {
    setIsActivating(true);
    setError(null);
    try {
      await onActivate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Activation failed";
      setError(message);
      setErrorModal({
        isOpen: true,
        title: "Activation Failed",
        message: message,
        onRetry: handleActivate,
      });
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeploy = async () => {
    if (!onDeployBase) return;
    setIsDeploying(true);
    setError(null);
    try {
      await onDeployBase();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Deployment failed";
      setError(message);
      setErrorModal({
        isOpen: true,
        title: "Deployment Failed",
        message: message,
        onRetry: handleDeploy,
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-end sm:items-center justify-center z-50 backdrop-blur-sm sm:p-4">
      <div className="w-full max-w-md bg-zinc-900 border-x-2 border-t-2 sm:border-2 border-primary rounded-t-2xl sm:rounded-2xl p-6 space-y-4 sm:space-y-6 max-h-[90vh] overflow-y-auto scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Header */}
        <div className="text-center space-y-1 sm:space-y-2">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Activate Your Account
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm">
            One-time setup required for gasless transactions
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-zinc-800 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-primary text-xs font-bold">1</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm">
                Approve Tokens
              </h3>
              <p className="text-zinc-400 text-xs mt-1">
                Grant permission for {tokens.length} tokens to use gasless
                features
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-primary text-xs font-bold">2</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm">
                Pay Once, Free Forever
              </h3>
              <p className="text-zinc-400 text-xs mt-1">
                Activation is sponsored by paymaster, then all future
                transactions are gasless
              </p>
            </div>
          </div>
        </div>

        {isBaseAppNotReady && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200 text-xs space-y-3">
            <div>
              <div className="text-sm font-semibold">
                Wallet not ready
              </div>
              <div className="mt-2 text-amber-100">
                Your wallet needs to be deployed on {config.chain.name}{" "}
                first. Click the button below to automatically deploy it.
              </div>
            </div>
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="w-full py-2.5 bg-amber-500 text-black font-semibold text-sm rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeploying ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  DEPLOYING WALLET...
                </span>
              ) : (
                "DEPLOY WALLET"
              )}
            </button>
          </div>
        )}

        {/* Status Message */}
        {isActivating && status && (
          <div className="flex items-center gap-2 text-primary text-sm justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{status}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="space-y-3">
            <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          </div>
        )}

        {/* Activate Button */}
        <button
          onClick={handleActivate}
          disabled={isActivating || isBaseAppNotReady}
          className="w-full py-3 sm:py-4 bg-primary text-black font-bold text-lg sm:text-xl rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isActivating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              ACTIVATING...
            </span>
          ) : (
            "ACTIVATE ACCOUNT"
          )}
        </button>

        {/* Switch Account / Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isActivating}
          className="w-full py-2.5 sm:py-3 border-2 border-zinc-600 text-zinc-300 font-semibold text-sm sm:text-base rounded-xl hover:bg-zinc-800 hover:border-zinc-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          LOG OUT
        </button>

        {/* Footer Note */}
        <p className="text-center text-zinc-500 text-xs">
          This is a one-time setup. You can't skip this step to use gasless
          features.
        </p>

        {/* Error Modal */}
        <Modal
          id="activation-error-modal"
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
    </div>
  );
}
