"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowUpDown, Loader2, AlertTriangle } from "lucide-react";
import { Currency, buildCurrencies } from "@/components/Currency";
import CurrencyBadge from "./CurrencyBadge";
import CurrencyModal from "./CurrencyModal";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { fetchSwapQuote, SwapQuoteResponse } from "@/api/swapApi";
import { parseUnits, formatUnits, type Address } from "viem";
import { createPublicClient, http } from "viem";
import { ERC20_ABI } from "@/config/abi";
import { ReceiptPopUp, ReceiptData } from "@/components/ReceiptPopUp";
import Modal from "@/components/Modal";
import { useActiveChain } from "@/hooks/useActiveChain";
import { isNoDataContractError, isRateLimitError } from "@/lib/viem-errors";

export default function SwapToken() {
  const { config } = useActiveChain();
  const currencies = useMemo(() => buildCurrencies(config), [config]);
  const [fromCurrency, setFromCurrency] = useState<Currency>(currencies[0]!); // default
  const [toCurrency, setToCurrency] = useState<Currency>(currencies[1] ?? currencies[0]!); // fallback
  const [amount, setAmount] = useState<string>("");
  const [swapQuote, setSwapQuote] = useState<SwapQuoteResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Receipt states
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Modal states
  const [showFromModal, setShowFromModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  const { smartAccountAddress, swapTokens, isLoading, isReady, status, error } =
    useSmartAccount();

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      }),
    [config],
  );

  useEffect(() => {
    if (!currencies.length) return;
    const defaultFrom =
      currencies.find(
        (token) =>
          token.symbol.toLowerCase() ===
          config.defaultTokenSymbol.toLowerCase(),
      ) ?? currencies[0];
    const defaultTo =
      currencies.find((token) => token.symbol !== defaultFrom.symbol) ||
      currencies[0];
    setFromCurrency(defaultFrom);
    setToCurrency(defaultTo);
    setSwapQuote(null);
  }, [config.defaultTokenSymbol, currencies]);

  const fetchBalance = useCallback(async () => {
    if (!smartAccountAddress) {
      setBalance("0");
      return;
    }

    setIsLoadingBalance(true);
    try {
      const rawBalance = await publicClient.readContract({
        address: fromCurrency.tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [smartAccountAddress],
      });
      setBalance(formatUnits(rawBalance as bigint, fromCurrency.decimals));
    } catch (err) {
      console.error("Failed to fetch balance:", err);
      setBalance("0");
      if (isNoDataContractError(err) || isRateLimitError(err)) {
        return;
      }
      setErrorModal({
        isOpen: true,
        title: "Balance Error",
        message: err instanceof Error ? err.message : "Failed to fetch balance",
        onRetry: fetchBalance,
      });
    } finally {
      setIsLoadingBalance(false);
    }
  }, [smartAccountAddress, fromCurrency, publicClient]);

  // Fetch balance of fromCurrency
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Check if balance is sufficient
  const numAmount = parseFloat(amount) || 0;
  const numBalance = parseFloat(balance) || 0;
  const quoteTotalRequired = swapQuote
    ? parseFloat(
      formatUnits(BigInt(swapQuote.totalUserPays), fromCurrency.decimals)
    )
    : numAmount;

  const hasInsufficientBalance =
    numAmount > 0 && quoteTotalRequired > numBalance;
  const hasNoBalance = numBalance === 0;

  // Debounced calculation - triggers 1 second after user stops typing
  useEffect(() => {
    const numAmount = parseFloat(amount);

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setSwapQuote(null);
      setQuoteError(null);
      return;
    }

    if (fromCurrency.tokenAddress === toCurrency.tokenAddress) {
      setQuoteError("Cannot swap same token");
      setSwapQuote(null);
      return;
    }

    setIsCalculating(true);
    setQuoteError(null);

    const timer = setTimeout(async () => {
      try {
        const amountIn = parseUnits(amount, fromCurrency.decimals);
        const quote = await fetchSwapQuote({
          tokenIn: fromCurrency.tokenAddress,
          tokenOut: toCurrency.tokenAddress,
          amountIn,
          chainId: config.chain.id,
        });
        setSwapQuote(quote);
        setQuoteError(null);
      } catch (err) {
        console.error("Quote error:", err);
        setQuoteError(err instanceof Error ? err.message : "Quote failed");
        setSwapQuote(null);
      } finally {
        setIsCalculating(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [amount, fromCurrency, toCurrency]);

  // Swap currencies
  const handleSwapCurrencies = useCallback(() => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
    setSwapQuote(null);
  }, [fromCurrency, toCurrency]);

  // Handle swap action
  const handleSwapNow = async () => {
    if (!swapQuote || !smartAccountAddress) return;

    try {
      const amountOut = BigInt(swapQuote.amountOut);
      const slippageBps = 50; // 0.5% slippage
      const minAmountOut = (amountOut * BigInt(10000 - slippageBps)) / 10000n;

      const txHash = await swapTokens({
        tokenIn: fromCurrency.tokenAddress as `0x${string}`,
        tokenOut: toCurrency.tokenAddress as `0x${string}`,
        amount,
        tokenInDecimals: fromCurrency.decimals,
        stableSwapAddress: config.stableSwapAddress,
        minAmountOut,
        totalUserPays: BigInt(swapQuote.totalUserPays),
      });

      // Create receipt for successful swap
      const receiptData: ReceiptData = {
        id: txHash,
        type: "swap",
        status: "success",
        timestamp: new Date(),
        amount: parseFloat(amount),
        currency: fromCurrency.symbol,
        currencyIcon: fromCurrency.icon,
        swapToAmount: Number(formatUnits(amountOut, toCurrency.decimals)),
        swapToCurrency: toCurrency.symbol,
        swapToCurrencyIcon: toCurrency.icon,
        txHash: txHash,
      };

      setReceipt(receiptData);
      setShowReceipt(true);
      await fetchBalance();
    } catch (err) {
      console.error("Swap error:", err);
      // Create failed receipt
      const receiptData: ReceiptData = {
        id: Date.now().toString(),
        type: "swap",
        status: "failed",
        timestamp: new Date(),
        amount: parseFloat(amount),
        currency: fromCurrency.symbol,
        currencyIcon: fromCurrency.icon,
        errorMessage: err instanceof Error ? err.message : "Swap failed",
      };
      setReceipt(receiptData);
      setShowReceipt(true);
    }
  };

  const formatNumber = (value: string, decimals: number) => {
    const num = Number(formatUnits(BigInt(value), decimals));
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const outputAmount = swapQuote
    ? formatNumber(swapQuote.amountOut, toCurrency.decimals)
    : "0";

  const feeAmount = swapQuote
    ? formatNumber(swapQuote.fee, fromCurrency.decimals)
    : "0";

  const rate = swapQuote
    ? (
        (parseFloat(
          formatUnits(BigInt(swapQuote.amountOut), toCurrency.decimals)
        ) || 0) /
        (parseFloat(
          formatUnits(BigInt(swapQuote.amountIn), fromCurrency.decimals)
        ) || 1)
      ).toFixed(4)
    : null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Connection Status - only show after isReady and still no smartAccountAddress */}
      {isReady && !smartAccountAddress && (
        <div className="p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-400 text-sm text-center">
          Connect wallet to enable swaps
        </div>
      )}

      {/* From Currency Input */}
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            const value = e.target.value.replace(/[^0-9.]/g, "");
            setAmount(value);
          }}
          placeholder="0"
          className="flex-1 min-w-0 bg-transparent text-white text-2xl sm:text-4xl font-light outline-none placeholder-zinc-600"
        />
        <CurrencyBadge
          currency={fromCurrency}
          onClick={() => setShowFromModal(true)}
        />
      </div>

      {/* Swap Direction Button */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-zinc-700" />
        </div>
        <button
          onClick={handleSwapCurrencies}
          className="relative z-10 p-2 bg-zinc-800 rounded-full border border-zinc-700 hover:border-zinc-500 transition-colors cursor-pointer"
        >
          <ArrowUpDown size={20} className="text-zinc-400" />
        </button>
      </div>

      {/* To Currency Output */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 text-2xl sm:text-4xl font-light truncate">
          {isCalculating ? (
            <span className="text-zinc-500 flex items-center gap-2">
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
              <span className="text-base sm:text-lg">Calculating...</span>
            </span>
          ) : swapQuote ? (
            <span className="text-white truncate">{outputAmount}</span>
          ) : (
            <span className="text-zinc-600">0</span>
          )}
        </div>
        <CurrencyBadge
          currency={toCurrency}
          onClick={() => setShowToModal(true)}
        />
      </div>

      {/* Rate and Fee - Only show when result is available */}
      {swapQuote && !isCalculating && (
        <div className="space-y-2 pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Rate</span>
            <span className="text-white">
              1 {fromCurrency.symbol} = {rate} {toCurrency.symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Fee</span>
            <span className="text-primary">
              {feeAmount} {fromCurrency.symbol}
            </span>
          </div>
        </div>
      )}

      {/* Status Message */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-primary text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          {status}
        </div>
      )}

      {/* Insufficient Balance Warning */}
      {smartAccountAddress && hasInsufficientBalance && (
        <div className="flex items-center gap-2 p-3 bg-orange-500/20 border border-orange-500 rounded-lg text-orange-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Insufficient {fromCurrency.symbol} balance. You have{" "}
            {numBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
            {fromCurrency.symbol}
          </span>
        </div>
      )}

      {/* No Balance Warning */}
      {smartAccountAddress && hasNoBalance && amount === "" && (
        <div className="flex items-center gap-2 p-3 bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>You don't have any {fromCurrency.symbol} tokens</span>
        </div>
      )}

      {/* Balance Info */}
      {smartAccountAddress && !hasNoBalance && (
        <div className="text-xs text-zinc-400 text-right">
          Balance:{" "}
          {isLoadingBalance
            ? "..."
            : numBalance.toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })}{" "}
          {fromCurrency.symbol}
        </div>
      )}

      {/* Swap Button - Only show when result is available */}
      {swapQuote && !isCalculating && smartAccountAddress && (
        <button
          onClick={handleSwapNow}
          disabled={isLoading || hasInsufficientBalance}
          className="w-full py-3 sm:py-4 bg-primary text-black font-bold text-base sm:text-lg md:text-xl rounded-xl hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading
            ? "PROCESSING..."
            : hasInsufficientBalance
              ? "INSUFFICIENT BALANCE"
              : "SWAP NOW"}
        </button>
      )}

      {/* Currency Selection Modals */}
      <CurrencyModal
        isOpen={showFromModal}
        onClose={() => setShowFromModal(false)}
        onSelect={setFromCurrency}
        excludeCurrency={toCurrency}
      />
      <CurrencyModal
        isOpen={showToModal}
        onClose={() => setShowToModal(false)}
        onSelect={setToCurrency}
        excludeCurrency={fromCurrency}
      />

      <ReceiptPopUp
        isOpen={showReceipt}
        data={receipt}
        onClose={() => setShowReceipt(false)}
      />

      {/* Error Modal */}
      <Modal
        id="swap-error-modal"
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
