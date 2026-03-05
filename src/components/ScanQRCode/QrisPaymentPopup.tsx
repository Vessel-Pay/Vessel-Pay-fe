"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  Zap,
} from "lucide-react";
import { createPublicClient, formatUnits, parseUnits, http } from "viem";
import type { Address } from "viem";
import {
  ERC20_ABI,
  STABLE_SWAP_ABI,
  STABLECOIN_REGISTRY_ABI,
} from "@/config/abi";
import {
  CurrencyDropdown,
  buildCurrencies,
  type Currency,
} from "@/components/Currency";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { useActiveChain } from "@/hooks/useActiveChain";
import Modal from "@/components/Modal";
import { ReceiptPopUp, type ReceiptData } from "@/components/ReceiptPopUp";

// Token rates: how many tokens equal 1 USD (for client-side estimation)
const TOKEN_RATES: Record<string, number> = {
  USDC: 1,
  USDS: 1,
  USDT: 1,
  EURC: 0.95,
  BRZ: 5,
  AUDD: 1.6,
  CADC: 1.35,
  ZCHF: 0.9,
  TGBP: 0.8,
  IDRX: 16000,
};

const FEE_MULTIPLIER = 1.001; // 0.1% swap fee per token
const VALUE_EPSILON = 1e-6;

// Convert token amount to USD value
const toUsdValue = (amount: number, tokenSymbol: string): number => {
  const rate = TOKEN_RATES[tokenSymbol] || 1;
  return amount / rate;
};

interface QrisPaymentPopupProps {
  recipient: string;
  merchantName: string;
  merchantId: string;
  merchantCity: string;
  qrisHash: string;
  onCancel: () => void;
}

interface TokenPaymentEntry {
  id: string;
  currency: Currency;
  amount: string;
  balance: string;
}

export default function QrisPaymentPopup({
  recipient,
  merchantName,
  merchantId,
  merchantCity,
  qrisHash,
  onCancel,
}: QrisPaymentPopupProps) {
  const { config } = useActiveChain();
  const currencies = useMemo(() => buildCurrencies(config), [config]);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      }),
    [config],
  );

  // Find IDRX as default target currency
  const idrxCurrency = useMemo(
    () => currencies.find((c) => c.symbol === "IDRX") || currencies[0],
    [currencies],
  );

  // Target amount in merchant's currency
  const [targetCurrency, setTargetCurrency] = useState<Currency>(idrxCurrency);
  const [targetAmount, setTargetAmount] = useState("");

  // Payment entries
  const [paymentEntries, setPaymentEntries] = useState<TokenPaymentEntry[]>([
    { id: "1", currency: idrxCurrency, amount: "", balance: "0" },
  ]);
  const [multiBalances, setMultiBalances] = useState<Record<string, string>>(
    {},
  );
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // On-chain verification state
  const [onChainTotalValue, setOnChainTotalValue] = useState<number | null>(
    null,
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );

  const {
    smartAccountAddress,
    isReady,
    sendGaslessTransfer,
    swapAndTransfer,
    qrisMultiTokenPayment,
    isLoading,
    status,
  } = useSmartAccount();

  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: "", message: "" });

  // Parse target amount
  const numTargetAmount = useMemo(
    () => parseFloat(targetAmount) || 0,
    [targetAmount],
  );

  // Required total including fees (0.5% buffer for swaps)
  const requiredTotal = useMemo(
    () => numTargetAmount * FEE_MULTIPLIER,
    [numTargetAmount],
  );

  // Fetch balances for all tokens
  useEffect(() => {
    if (!smartAccountAddress) return;

    const fetchBalances = async () => {
      const balances: Record<string, string> = {};
      for (const currency of currencies) {
        try {
          const rawBalance = await publicClient.readContract({
            address: currency.tokenAddress as Address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [smartAccountAddress],
          });
          balances[currency.tokenAddress] = formatUnits(
            rawBalance as bigint,
            currency.decimals,
          );
        } catch {
          balances[currency.tokenAddress] = "0";
        }
      }
      setMultiBalances(balances);
      // Update existing entries with new balances
      setPaymentEntries((prev) =>
        prev.map((p) => ({
          ...p,
          balance: balances[p.currency.tokenAddress] || "0",
        })),
      );
    };

    fetchBalances();
  }, [smartAccountAddress, currencies, publicClient]);

  // Payment mode detection
  const paymentMode = useMemo(() => {
    const validEntries = paymentEntries.filter((e) => parseFloat(e.amount) > 0);

    if (validEntries.length === 0) return "empty";
    if (validEntries.length === 1) {
      const isSameToken =
        validEntries[0].currency.tokenAddress.toLowerCase() ===
        targetCurrency.tokenAddress.toLowerCase();
      return isSameToken ? "single-direct" : "single-swap";
    }
    return "multi";
  }, [paymentEntries, targetCurrency]);

  // Calculate current total input in target currency (client-side estimate)
  const estimatedTotal = useMemo(() => {
    return paymentEntries.reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      const usdValue = toUsdValue(amt, p.currency.symbol);
      return sum + usdValue * (TOKEN_RATES[targetCurrency.symbol] || 1);
    }, 0);
  }, [paymentEntries, targetCurrency]);

  // Current total (on-chain verified or estimated)
  const currentTotal = useMemo(
    () => onChainTotalValue ?? estimatedTotal,
    [onChainTotalValue, estimatedTotal],
  );

  // Check for insufficient balances
  const hasInsufficientBalance = useMemo(() => {
    return paymentEntries.some((p) => {
      const amt = parseFloat(p.amount) || 0;
      const bal = parseFloat(p.balance) || 0;
      // Apply fee for tokens that need swap
      const needsSwap =
        p.currency.tokenAddress.toLowerCase() !==
        targetCurrency.tokenAddress.toLowerCase();
      const required = needsSwap ? amt * FEE_MULTIPLIER : amt;
      return amt > 0 && required > bal;
    });
  }, [paymentEntries, targetCurrency]);

  // Check if current total is sufficient
  const hasInsufficientValue =
    currentTotal > 0 && currentTotal < requiredTotal - VALUE_EPSILON;
  const hasExcessValue = currentTotal > requiredTotal + VALUE_EPSILON;

  // Token entry management
  const addPaymentEntry = () => {
    const availableCurrencies = currencies.filter(
      (c) =>
        !paymentEntries.some((p) => p.currency.tokenAddress === c.tokenAddress),
    );
    if (availableCurrencies.length === 0) return;
    setPaymentEntries([
      ...paymentEntries,
      {
        id: Date.now().toString(),
        currency: availableCurrencies[0],
        amount: "",
        balance: multiBalances[availableCurrencies[0].tokenAddress] || "0",
      },
    ]);
  };

  const removePaymentEntry = (id: string) => {
    if (paymentEntries.length <= 1) return;
    setPaymentEntries(paymentEntries.filter((p) => p.id !== id));
  };

  const updatePaymentEntry = (
    id: string,
    field: "currency" | "amount",
    value: Currency | string,
  ) => {
    setPaymentEntries(
      paymentEntries.map((p) =>
        p.id === id
          ? {
              ...p,
              [field]: value,
              ...(field === "currency" && typeof value !== "string"
                ? { balance: multiBalances[value.tokenAddress] || "0" }
                : {}),
            }
          : p,
      ),
    );
  };

  // Fill remaining amount for a specific entry (like TransactionPopup)
  const fillRemainingAmount = useCallback(
    (entryId: string) => {
      if (numTargetAmount <= 0) return;

      // Calculate current total from other entries (excluding the target entry)
      const otherEntriesTotal = paymentEntries
        .filter((p) => p.id !== entryId)
        .reduce((sum, p) => {
          const amt = parseFloat(p.amount) || 0;
          return sum + toUsdValue(amt, p.currency.symbol);
        }, 0);

      // Calculate how much is still needed in target currency
      const otherEntriesInTarget =
        otherEntriesTotal * (TOKEN_RATES[targetCurrency.symbol] || 1);
      const remainingNeeded = requiredTotal - otherEntriesInTarget;

      if (remainingNeeded <= 0) return;

      // Find the target entry and calculate amount in that token
      const targetEntry = paymentEntries.find((p) => p.id === entryId);
      if (!targetEntry) return;

      const targetRate = TOKEN_RATES[targetEntry.currency.symbol] || 1;
      const targetCurrencyRate = TOKEN_RATES[targetCurrency.symbol] || 1;

      // Convert remaining needed to target entry's token
      const amountInEntryToken =
        (remainingNeeded / targetCurrencyRate) * targetRate;

      // Check balance limit
      const balance = parseFloat(targetEntry.balance) || 0;
      const finalAmount = Math.min(amountInEntryToken, balance);

      // Update the entry with calculated amount
      setPaymentEntries((prev) =>
        prev.map((p) =>
          p.id === entryId ? { ...p, amount: finalAmount.toFixed(6) } : p,
        ),
      );
    },
    [paymentEntries, targetCurrency, requiredTotal, numTargetAmount],
  );

  // Calculate shortfall options for display
  const shortfallOptions = useMemo(() => {
    if (currentTotal >= requiredTotal - VALUE_EPSILON) return [];

    const shortfallInTarget = requiredTotal - currentTotal;

    return paymentEntries
      .filter((p) => parseFloat(p.amount) > 0)
      .map((p) => {
        const rate = TOKEN_RATES[p.currency.symbol] || 1;
        const targetRate = TOKEN_RATES[targetCurrency.symbol] || 1;
        const shortfallInThisToken = (shortfallInTarget / targetRate) * rate;
        const currentAmount = parseFloat(p.amount) || 0;
        const nextAmount = currentAmount + shortfallInThisToken;
        return {
          symbol: p.currency.symbol,
          amount: shortfallInThisToken,
          currentAmount,
          nextAmount,
        };
      });
  }, [paymentEntries, currentTotal, requiredTotal, targetCurrency]);

  // On-chain verification effect (debounced)
  useEffect(() => {
    const paymentsWithAmount = paymentEntries.filter(
      (p) => parseFloat(p.amount) > 0,
    );
    if (paymentsWithAmount.length === 0) {
      setOnChainTotalValue(null);
      setVerificationError(null);
      return;
    }

    // Only verify if there's at least one swap needed
    const needsVerification = paymentsWithAmount.some(
      (p) =>
        p.currency.tokenAddress.toLowerCase() !==
        targetCurrency.tokenAddress.toLowerCase(),
    );

    if (!needsVerification) {
      // Direct calculation for same-token payments
      const total = paymentsWithAmount.reduce(
        (sum, p) => sum + (parseFloat(p.amount) || 0),
        0,
      );
      setOnChainTotalValue(total);
      setVerificationError(null);
      return;
    }

    // Debounce: wait 1 second after user stops typing
    const timer = setTimeout(async () => {
      setIsVerifying(true);
      setVerificationError(null);

      try {
        let totalInTargetToken = 0n;
        const targetTokenDecimals = targetCurrency.decimals;

        for (const payment of paymentsWithAmount) {
          const amountRaw = parseUnits(
            payment.amount,
            payment.currency.decimals,
          );

          if (
            payment.currency.tokenAddress.toLowerCase() ===
            targetCurrency.tokenAddress.toLowerCase()
          ) {
            totalInTargetToken += amountRaw;
          } else {
            // Get swap quote from StableSwap
            try {
              const [amountOut] = (await publicClient.readContract({
                address: config.stableSwapAddress,
                abi: STABLE_SWAP_ABI,
                functionName: "getSwapQuote",
                args: [
                  payment.currency.tokenAddress as Address,
                  targetCurrency.tokenAddress as Address,
                  amountRaw,
                ],
              })) as [bigint, bigint, bigint];
              totalInTargetToken += amountOut;
            } catch {
              // Fallback to registry conversion
              const converted = (await publicClient.readContract({
                address: config.stablecoinRegistryAddress,
                abi: STABLECOIN_REGISTRY_ABI,
                functionName: "convert",
                args: [
                  payment.currency.tokenAddress as Address,
                  targetCurrency.tokenAddress as Address,
                  amountRaw,
                ],
              })) as bigint;
              totalInTargetToken += converted;
            }
          }
        }

        const totalNumber = Number(
          formatUnits(totalInTargetToken, targetTokenDecimals),
        );
        setOnChainTotalValue(totalNumber);
      } catch (err) {
        console.error("On-chain verification error:", err);
        setVerificationError("Verification failed");
        setOnChainTotalValue(null);
      } finally {
        setIsVerifying(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [paymentEntries, targetCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!smartAccountAddress) return;

    if (numTargetAmount <= 0) {
      setErrorModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please enter an amount to send",
      });
      return;
    }

    const validEntries = paymentEntries.filter((p) => parseFloat(p.amount) > 0);
    if (validEntries.length === 0) {
      setErrorModal({
        isOpen: true,
        title: "Validation Error",
        message: "Please add payment tokens",
      });
      return;
    }

    if (hasInsufficientBalance || hasInsufficientValue) {
      return;
    }

    try {
      let txHash: string;

      if (paymentMode === "single-direct") {
        // Direct transfer - no swap needed
        const entry = validEntries[0];
        txHash = await sendGaslessTransfer({
          recipient: recipient as Address,
          amount: targetAmount, // Send exact target amount
          tokenAddress: entry.currency.tokenAddress as Address,
          decimals: entry.currency.decimals,
        });

        setReceipt({
          id: txHash,
          type: "send",
          status: "success",
          timestamp: new Date(),
          amount: numTargetAmount,
          currency: targetCurrency.symbol,
          currencyIcon: targetCurrency.icon,
          toAddress: recipient,
          txHash: txHash,
        });
      } else if (paymentMode === "single-swap") {
        // Single token swap then transfer
        const entry = validEntries[0];
        const amountParsed = parseUnits(entry.amount, entry.currency.decimals);

        // Get swap quote for min amount out
        const [amountOut, , totalUserPays] = (await publicClient.readContract({
          address: config.stableSwapAddress,
          abi: STABLE_SWAP_ABI,
          functionName: "getSwapQuote",
          args: [
            entry.currency.tokenAddress as Address,
            targetCurrency.tokenAddress as Address,
            amountParsed,
          ],
        })) as [bigint, bigint, bigint];

        // Check allowance
        const currentAllowance = (await publicClient.readContract({
          address: entry.currency.tokenAddress as Address,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [smartAccountAddress, config.stableSwapAddress],
        })) as bigint;

        const result = await swapAndTransfer({
          tokenIn: entry.currency.tokenAddress as Address,
          tokenOut: targetCurrency.tokenAddress as Address,
          amountIn: entry.amount,
          tokenInDecimals: entry.currency.decimals,
          tokenOutDecimals: targetCurrency.decimals,
          recipient: recipient as Address,
          stableSwapAddress: config.stableSwapAddress,
          minAmountOut: amountOut,
          totalUserPays,
          currentAllowance,
        });

        txHash = result.txHash;
        setReceipt({
          id: txHash,
          type: "send",
          status: "success",
          timestamp: new Date(),
          amount: Number(formatUnits(amountOut, targetCurrency.decimals)),
          currency: targetCurrency.symbol,
          currencyIcon: targetCurrency.icon,
          senderCurrency: entry.currency.symbol,
          senderCurrencyIcon: entry.currency.icon,
          toAddress: recipient,
          txHash: txHash,
          tokenBreakdown: [
            {
              symbol: entry.currency.symbol,
              amount: parseFloat(entry.amount),
              icon: entry.currency.icon,
            },
          ],
        });
      } else {
        // Multi-token payment - batch all in single UserOp
        const breakdown: { symbol: string; amount: number; icon: string }[] =
          [];
        const payments: {
          token: Address;
          amount: bigint;
          decimals: number;
          needsSwap: boolean;
          swapAmountOut?: bigint;
        }[] = [];

        let totalAmountOut = 0n;

        // Prepare all payments with swap quotes
        for (const entry of validEntries) {
          const amountParsed = parseUnits(
            entry.amount,
            entry.currency.decimals,
          );
          const needsSwap =
            entry.currency.tokenAddress.toLowerCase() !==
            targetCurrency.tokenAddress.toLowerCase();

          if (needsSwap) {
            // Get swap quote
            const [amountOut] = (await publicClient.readContract({
              address: config.stableSwapAddress,
              abi: STABLE_SWAP_ABI,
              functionName: "getSwapQuote",
              args: [
                entry.currency.tokenAddress as Address,
                targetCurrency.tokenAddress as Address,
                amountParsed,
              ],
            })) as [bigint, bigint, bigint];

            payments.push({
              token: entry.currency.tokenAddress as Address,
              amount: amountParsed,
              decimals: entry.currency.decimals,
              needsSwap: true,
              swapAmountOut: amountOut,
            });
            totalAmountOut += amountOut;
          } else {
            payments.push({
              token: entry.currency.tokenAddress as Address,
              amount: amountParsed,
              decimals: entry.currency.decimals,
              needsSwap: false,
            });
            totalAmountOut += amountParsed;
          }

          breakdown.push({
            symbol: entry.currency.symbol,
            amount: parseFloat(entry.amount),
            icon: entry.currency.icon,
          });
        }

        // Execute all in single UserOp
        const result = await qrisMultiTokenPayment({
          payments,
          targetToken: targetCurrency.tokenAddress as Address,
          targetTokenDecimals: targetCurrency.decimals,
          recipient: recipient as Address,
          totalAmountOut,
          stableSwapAddress: config.stableSwapAddress,
        });

        txHash = result.txHash;
        setReceipt({
          id: txHash,
          type: "send",
          status: "success",
          timestamp: new Date(),
          amount: Number(formatUnits(totalAmountOut, targetCurrency.decimals)),
          currency: targetCurrency.symbol,
          currencyIcon: targetCurrency.icon,
          toAddress: recipient,
          txHash: txHash,
          tokenBreakdown: breakdown,
        });
      }

      setShowReceipt(true);
      setTargetAmount("");
      setPaymentEntries([
        {
          id: "1",
          currency: idrxCurrency,
          amount: "",
          balance: multiBalances[idrxCurrency.tokenAddress] || "0",
        },
      ]);
    } catch (error) {
      console.error("QRIS payment error:", error);
      setReceipt({
        id: Date.now().toString(),
        type: "send",
        status: "failed",
        timestamp: new Date(),
        amount: numTargetAmount,
        currency: targetCurrency.symbol,
        currencyIcon: targetCurrency.icon,
        toAddress: recipient,
        errorMessage: error instanceof Error ? error.message : "Payment failed",
      });
      setShowReceipt(true);
    }
  };

  const shortenAddress = (addr: string) => {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    const sanitized = value.replace(/^(\d*\.\d*).*$/, "$1");
    setTargetAmount(sanitized);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-2 sm:p-4 z-50">
      <div
        className="w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-zinc-800 rounded-2xl p-3 sm:p-6 border-2 border-primary scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <h2 className="text-white text-lg sm:text-xl font-bold text-center mb-4 sm:mb-6">
          QRIS Payment
        </h2>

        {isReady && !smartAccountAddress && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-400 text-sm text-center">
            Connect wallet to make payment
          </div>
        )}

        <div className="space-y-4">
          {/* Merchant Info */}
          <div className="p-3 bg-zinc-900/60 border border-zinc-700 rounded-xl text-xs space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">Merchant</span>
              <span className="text-white text-right">
                {merchantName || "-"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">Merchant ID</span>
              <span className="text-white text-right">{merchantId || "-"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">City</span>
              <span className="text-white text-right">
                {merchantCity || "-"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-400">Recipient</span>
              <span className="text-white font-mono text-right">
                {shortenAddress(recipient)}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Merchant Receives Section */}
            <div className="p-4 bg-zinc-700/30 rounded-xl space-y-3">
              <label className="text-white text-sm font-medium block">
                Merchant Receives
              </label>

              <div className="flex gap-2">
                <div className="flex-1">
                  <CurrencyDropdown
                    value={targetCurrency}
                    onChange={setTargetCurrency}
                  />
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={targetAmount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  className="w-32 p-3 bg-zinc-800 border border-zinc-600 rounded-xl text-white text-right text-lg font-medium focus:outline-none focus:border-primary"
                />
              </div>

              {numTargetAmount > 0 && (
                <div className="text-xs text-zinc-500 text-right">
                  Required: ~
                  {requiredTotal.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {targetCurrency.symbol} (incl. fees)
                </div>
              )}
            </div>

            {/* Pay With Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-white text-sm font-medium">
                  Pay With
                </label>
                <button
                  type="button"
                  onClick={addPaymentEntry}
                  disabled={paymentEntries.length >= currencies.length}
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" /> Add Token
                </button>
              </div>

              {paymentEntries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="bg-zinc-700/30 p-2 sm:p-3 rounded-lg space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <CurrencyDropdown
                        value={entry.currency}
                        onChange={(c) =>
                          updatePaymentEntry(entry.id, "currency", c)
                        }
                      />
                    </div>
                    <input
                      type="number"
                      value={entry.amount}
                      onChange={(e) =>
                        updatePaymentEntry(entry.id, "amount", e.target.value)
                      }
                      placeholder="0"
                      className="w-20 sm:w-24 p-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-right text-sm focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => fillRemainingAmount(entry.id)}
                      disabled={numTargetAmount <= 0}
                      className="px-2 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50"
                      title="Fill remaining amount"
                    >
                      <Zap className="w-3 h-3" />
                      <span className="hidden sm:inline">Fill</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removePaymentEntry(entry.id)}
                      disabled={paymentEntries.length <= 1}
                      className="p-2 text-red-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>
                      Balance:{" "}
                      {parseFloat(entry.balance).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{" "}
                      {entry.currency.symbol}
                    </span>
                    {entry.currency.tokenAddress.toLowerCase() !==
                      targetCurrency.tokenAddress.toLowerCase() && (
                      <span className="text-orange-400">+0.1% swap fee</span>
                    )}
                  </div>
                  {idx === 0 &&
                    paymentMode !== "single-direct" &&
                    paymentMode !== "empty" && (
                      <div className="text-xs text-primary/80">
                        Gas fee token
                      </div>
                    )}
                </div>
              ))}
            </div>

            {/* Total Summary */}
            {numTargetAmount > 0 &&
              paymentEntries.some((p) => parseFloat(p.amount) > 0) && (
                <div className="p-3 bg-zinc-700/30 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">
                      Your Total ({targetCurrency.symbol})
                    </span>
                    <div className="flex items-center gap-2">
                      {isVerifying ? (
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Verifying...
                        </span>
                      ) : onChainTotalValue !== null ? (
                        <span className="text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          {onChainTotalValue.toLocaleString(undefined, {
                            maximumFractionDigits: 6,
                          })}
                        </span>
                      ) : (
                        <span className="text-zinc-300">
                          ~
                          {estimatedTotal.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}
                          <span className="text-zinc-500 text-xs ml-1">
                            (est)
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Required (incl. fees)</span>
                    <span className="text-white font-medium">
                      {requiredTotal.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{" "}
                      {targetCurrency.symbol}
                    </span>
                  </div>

                  {verificationError && (
                    <div className="text-xs text-orange-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {verificationError} - using estimate
                    </div>
                  )}

                  {/* Shortfall Warning */}
                  {shortfallOptions.length > 0 && (
                    <div className="p-2 bg-orange-500/20 border border-orange-500/50 rounded-lg">
                      <div className="flex items-center gap-2 text-orange-400 text-sm font-medium mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        Need more to complete payment:
                      </div>
                      <div className="text-xs text-orange-300 space-y-0.5">
                        {shortfallOptions.map((opt, idx) => (
                          <div key={opt.symbol}>
                            {idx > 0 && (
                              <span className="text-orange-400/70">or </span>
                            )}
                            <span className="font-mono">
                              +
                              {opt.amount.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}
                            </span>
                            <span className="ml-1">{opt.symbol}</span>
                            <span className="ml-1 text-orange-400/80">
                              (
                              {opt.nextAmount.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}{" "}
                              {opt.symbol})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Excess Warning */}
                  {hasExcessValue && (
                    <div className="p-2 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                      <div className="flex items-center gap-2 text-blue-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Amount exceeds required - merchant will receive extra
                      </div>
                    </div>
                  )}

                  {/* Success Indicator */}
                  {!hasInsufficientValue &&
                    !hasExcessValue &&
                    onChainTotalValue !== null && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Sufficient amount
                      </div>
                    )}
                </div>
              )}

            {/* Insufficient Balance Warning */}
            {smartAccountAddress && hasInsufficientBalance && (
              <div className="flex items-center gap-2 p-3 bg-orange-500/20 border border-orange-500 rounded-lg text-orange-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Insufficient balance for one or more tokens</span>
              </div>
            )}

            {/* Status */}
            {isLoading && status && (
              <div className="flex items-center justify-center gap-2 text-primary text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {status}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={
                  isLoading ||
                  !smartAccountAddress ||
                  hasInsufficientBalance ||
                  hasInsufficientValue ||
                  numTargetAmount <= 0 ||
                  paymentMode === "empty"
                }
                className="w-full py-3 bg-primary text-black font-bold text-base rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? "PROCESSING..."
                  : paymentMode === "multi"
                    ? "PAY WITH MULTI-TOKEN"
                    : paymentMode === "single-swap"
                      ? "SWAP & PAY"
                      : "PAY NOW"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="w-full py-3 border-2 border-primary text-primary font-bold text-base rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                CANCEL
              </button>
            </div>
          </form>
        </div>
      </div>

      <Modal
        id="qris-payment-error-modal"
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

      <ReceiptPopUp
        isOpen={showReceipt}
        data={receipt}
        onClose={() => {
          setShowReceipt(false);
          onCancel();
        }}
      />
    </div>
  );
}
