"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import Modal from "@/components/Modal";
import { Currency, buildCurrencies } from "@/components/Currency";
import { useActiveChain } from "@/hooks/useActiveChain";
import {
  createPublicClient,
  formatUnits,
  http,
  parseUnits,
  type Address,
} from "viem";
import { STABLECOIN_REGISTRY_ABI } from "@/config/abi";

interface IdRxTransaction {
  reference: string;
  toBeMinted: string;
  paymentStatus?: string;
  userMintStatus?: string;
  createdAt?: string;
  requestType?: string;
}

export default function TopUpIDRX() {
  const { config } = useActiveChain();
  const { smartAccountAddress, isReady } = useSmartAccount();

  const TOPUP_LIMITS: Record<string, { min: number; max: number }> = {
    IDRX: { min: 20000, max: 1_000_000_000 },
    USDC: { min: 2, max: 5555 },
  };
  const HISTORY_TAKE = 5;

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      }),
    [config],
  );

  const currencies = useMemo(() => buildCurrencies(config), [config]);
  const topUpTokens = useMemo(
    () =>
      currencies.filter(
        (token) => token.symbol === "IDRX" || token.symbol === "USDC",
      ),
    [currencies],
  );
  const [topUpToken, setTopUpToken] = useState<Currency | null>(
    topUpTokens[0] || null,
  );
  const [isTokenMenuOpen, setIsTokenMenuOpen] = useState(false);
  const tokenMenuRef = useRef<HTMLDivElement>(null);

  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const [history, setHistory] = useState<IdRxTransaction[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageCount, setHistoryPageCount] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmChecked, setIsConfirmChecked] = useState(false);

  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  const formattedAmount = useMemo(() => {
    const value = Number(amount || 0);
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }, [amount]);
  const numericAmount = Number(amount);
  const hasValidAmount = Number.isFinite(numericAmount) && numericAmount > 0;
  const activeToken = topUpToken || topUpTokens[0];
  const limits =
    TOPUP_LIMITS[activeToken?.symbol || "IDRX"] || TOPUP_LIMITS.IDRX;
  const isBelowMin = hasValidAmount && numericAmount < limits.min;
  const isAboveMax = hasValidAmount && numericAmount > limits.max;
  const isOutOfRange = isBelowMin || isAboveMax;

  if (!activeToken) {
    return null;
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tokenMenuRef.current &&
        !tokenMenuRef.current.contains(event.target as Node)
      ) {
        setIsTokenMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setPaymentUrl(null);
    setReference(null);
  }, [topUpToken]);

  useEffect(() => {
    if (!topUpTokens.length) return;
    const defaultToken =
      topUpTokens.find((token) => token.symbol === "IDRX") || topUpTokens[0];
    setTopUpToken(defaultToken);
  }, [topUpTokens]);

  const openConfirmModal = () => {
    setIsConfirmChecked(false);
    setIsConfirmOpen(true);
  };

  const closeConfirmModal = () => {
    setIsConfirmOpen(false);
    setIsConfirmChecked(false);
  };

  const loadHistory = useCallback(
    async (page: number = 1) => {
      if (!smartAccountAddress) {
        setHistory([]);
        setHistoryPage(1);
        setHistoryPageCount(0);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const response = await fetch(
          `/api/idrx/transaction-history?transactionType=MINT&walletAddress=${smartAccountAddress}&page=${page}&take=${HISTORY_TAKE}&requestType=idrx&chain=${config.key}`,
        );
        if (!response.ok) {
          throw new Error("Failed to fetch transaction history.");
        }
        const result = await response.json();
        const data = result?.data;
        const records = Array.isArray(data) ? data : data?.records || [];
        const metadata = !Array.isArray(data) ? data?.metadata : null;
        setHistory(records);
        setHistoryPage(page);
        setHistoryPageCount(metadata?.pageCount || 0);
      } catch (err) {
        setHistory([]);
        setErrorModal({
          isOpen: true,
          title: "History Error",
          message:
            err instanceof Error ? err.message : "Failed to load transaction history",
          onRetry: () => loadHistory(page),
        });
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [smartAccountAddress, config.key],
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const hasNextPage = historyPageCount
    ? historyPage < historyPageCount
    : history.length === HISTORY_TAKE;

  const handleCreatePayment = async () => {
    if (!smartAccountAddress) return;

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorModal({
        isOpen: true,
        title: "Invalid Amount",
        message: "Please enter a valid top up amount.",
      });
      return;
    }
    if (numericAmount < limits.min || numericAmount > limits.max) {
      setErrorModal({
        isOpen: true,
        title: "Amount Out of Range",
        message: `Allowed range: ${limits.min.toLocaleString()} - ${limits.max.toLocaleString()} ${activeToken.symbol}.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let amountToMint = amount;
      if (!activeToken) {
        throw new Error("Token configuration is missing.");
      }
      if (activeToken.symbol === "USDC") {
        const idrxToken = currencies.find((token) => token.symbol === "IDRX");
        if (!idrxToken) {
          throw new Error("IDRX token configuration is missing.");
        }
        const amountRaw = parseUnits(amount, activeToken.decimals);
        const converted = (await publicClient.readContract({
          address: config.stablecoinRegistryAddress,
          abi: STABLECOIN_REGISTRY_ABI,
          functionName: "convert",
          args: [
            activeToken.tokenAddress as Address,
            idrxToken.tokenAddress as Address,
            amountRaw,
          ],
        })) as bigint;
        amountToMint = formatUnits(converted, idrxToken.decimals);
      }

      const response = await fetch("/api/idrx/mint-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountToMint,
          walletAddress: smartAccountAddress,
          token: activeToken.symbol.toLowerCase(),
          chain: config.key,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result?.paymentUrl) {
        throw new Error(result?.error || "Failed to create payment request.");
      }

      setPaymentUrl(result.paymentUrl);
      setReference(result.reference || null);
      window.open(result.paymentUrl, "_blank", "noopener,noreferrer");
      setAmount("");
      await loadHistory();
    } catch (err) {
      setErrorModal({
        isOpen: true,
        title: "Top Up Error",
        message:
          err instanceof Error ? err.message : "Failed to create payment request",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isReady && !smartAccountAddress) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">Connect wallet to top up IDRX</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <label className="text-zinc-400 text-sm">Receive as</label>
        <div ref={tokenMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setIsTokenMenuOpen(!isTokenMenuOpen)}
            className="w-full flex items-center justify-between p-3 sm:p-4 bg-zinc-800 rounded-xl border border-zinc-700 hover:border-zinc-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                <Image
                  src={activeToken.icon}
                  alt={activeToken.name}
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
              <div className="text-left">
                <p className="text-white font-medium">{activeToken.name}</p>
                <p className="text-zinc-400 text-sm">{activeToken.symbol}</p>
              </div>
            </div>
            <ChevronDown
              className={`text-zinc-400 transition-transform ${
                isTokenMenuOpen ? "rotate-180" : ""
              }`}
              size={20}
            />
          </button>
          {isTokenMenuOpen && (
            <div className="absolute z-50 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl max-h-64 overflow-y-auto">
              {topUpTokens.map((token) => (
                <button
                  key={token.id}
                  type="button"
                  onClick={() => {
                    setTopUpToken(token);
                    setIsTokenMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 p-4 hover:bg-zinc-700 transition-colors cursor-pointer ${
                    topUpToken?.id === token.id ? "bg-zinc-700" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-600 flex items-center justify-center overflow-hidden">
                    <Image
                      src={token.icon}
                      alt={token.name}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">{token.name}</p>
                    <p className="text-zinc-400 text-sm">{token.symbol}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-zinc-400 text-sm">
          Top Up Amount ({activeToken.symbol})
        </label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 text-white text-base sm:text-lg md:text-xl outline-none focus:border-primary"
        />
        {amount && (
          <div className="text-xs text-zinc-400">
            {formattedAmount} {activeToken.symbol}
          </div>
        )}
        {isBelowMin && (
          <div className="text-xs text-orange-400">
            Below minimum: {limits.min.toLocaleString()} {activeToken.symbol}
          </div>
        )}
        {isAboveMax && (
          <div className="text-xs text-orange-400">
            Above maximum: {limits.max.toLocaleString()} {activeToken.symbol}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <span className="text-zinc-400 text-sm">Destination Wallet</span>
        <div className="p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-xs text-zinc-300 break-all font-mono">
          {smartAccountAddress || "-"}
        </div>
      </div>

      <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-xl space-y-2">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
            <span className="text-amber-500 text-xs font-bold">⚠</span>
          </div>
          <div className="space-y-1 flex-1">
            <p className="text-amber-400 font-semibold text-sm">
              Direct IDRX API Integration
            </p>
            <p className="text-amber-200/80 text-xs leading-relaxed">
              This top-up connects directly to the official IDRX API. You are
              purchasing mainnet coin with actual monetary value.
              Please transact carefully.
            </p>
          </div>
        </div>
      </div>

      {paymentUrl && (
        <div className="p-4 bg-zinc-800/60 border border-zinc-700 rounded-xl space-y-2">
          <div className="text-sm text-zinc-200">Payment link created</div>
          {reference && (
            <div className="text-xs text-zinc-400">
              Reference: <span className="font-mono">{reference}</span>
            </div>
          )}
          <button
            onClick={() =>
              window.open(paymentUrl, "_blank", "noopener,noreferrer")
            }
            className="inline-flex items-center gap-2 text-primary text-sm hover:text-primary/80"
          >
            Open payment page <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      )}

      <button
        onClick={openConfirmModal}
        disabled={
          !smartAccountAddress ||
          isSubmitting ||
          !hasValidAmount ||
          isOutOfRange
        }
        className="w-full py-3 sm:py-4 bg-primary text-black font-bold text-base sm:text-lg md:text-xl rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "CREATING LINK..." : "TOP UP IDRX"}
      </button>

      <Modal
        id="idrx-topup-confirm-modal"
        role="dialog"
        aria-modal={true}
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
        tabIndex={-1}
        isOpen={isConfirmOpen}
        onClose={closeConfirmModal}
        title="Confirm Top Up"
      >
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm text-center">
            Please review and accept the notice below before continuing.
          </p>
          <div
            id="confirm-desc"
            className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-3 text-xs text-zinc-300 leading-relaxed"
          >
            By proceeding, you acknowledge that this will send IDRX/USDC mainnet
            funds to your Smart Account. Currently Vessel Pay only support Testnet.
            The Vessel Pay Team is not responsible for any loss.
          </div>
          <label className="flex items-start gap-3 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={isConfirmChecked}
              onChange={(e) => setIsConfirmChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-primary focus:ring-primary"
            />
            <span>I understand and accept this notice.</span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={closeConfirmModal}
              className="w-full py-3 border-2 border-zinc-600 text-zinc-200 font-bold text-sm sm:text-base rounded-xl hover:bg-zinc-700/40 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                closeConfirmModal();
                handleCreatePayment();
              }}
              disabled={!isConfirmChecked || isSubmitting}
              className="w-full py-3 bg-primary text-black font-bold text-sm sm:text-base rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Top Up
            </button>
          </div>
        </div>
      </Modal>

      <div className="border-t border-zinc-800 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400 text-sm">Recent top ups</span>
          <button
            onClick={() => loadHistory(historyPage)}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            title="Refresh"
            disabled={isLoadingHistory}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isLoadingHistory ? (
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="text-zinc-500 text-sm">No top ups yet</div>
        ) : (
          <>
            <div className="divide-y divide-zinc-800">
              {history.map((item) => {
                const status = item.paymentStatus || item.userMintStatus || "-";
                const createdAt = item.createdAt
                  ? new Date(item.createdAt).toLocaleString()
                  : "-";
                const amountValue = Number(item.toBeMinted || 0);
                const amountLabel = Number.isFinite(amountValue)
                  ? amountValue.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })
                  : item.toBeMinted;
                const rawToken = (item.requestType || "idrx").toLowerCase();
                const recordToken =
                  rawToken === "usdt" ? "USDC" : rawToken.toUpperCase();

                return (
                  <div key={item.reference} className="py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-white">
                        {amountLabel} {recordToken}
                      </span>
                      <span className="text-xs text-zinc-400">{status}</span>
                    </div>
                    <div className="text-xs text-zinc-500">
                      {item.reference} • {createdAt}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-3 text-xs text-zinc-400">
              <button
                onClick={() => loadHistory(Math.max(1, historyPage - 1))}
                disabled={historyPage <= 1 || isLoadingHistory}
                className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span>
                Page {historyPage}
                {historyPageCount ? ` of ${historyPageCount}` : ""}
              </span>
              <button
                onClick={() => loadHistory(historyPage + 1)}
                disabled={!hasNextPage || isLoadingHistory}
                className="px-3 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      <Modal
        id="idrx-topup-error-modal"
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
            className="w-full py-3 sm:py-4 bg-primary text-black font-bold text-base sm:text-lg rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
          >
            RETRY
          </button>
        )}
      </Modal>
    </div>
  );
}
