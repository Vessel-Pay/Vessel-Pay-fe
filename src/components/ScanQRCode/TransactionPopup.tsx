"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import {
  Loader2,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle,
  Zap,
} from "lucide-react";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { buildCurrencies, Currency } from "@/components/Currency";
import { CurrencyDropdown } from "@/components/Currency";
import {
  createPublicClient,
  http,
  formatUnits,
  parseUnits,
  type Address,
} from "viem";
import {
  PAYMENT_PROCESSOR_ABI,
  ERC20_ABI,
  STABLECOIN_REGISTRY_ABI,
} from "@/config/abi";
import { isNoDataContractError, isRateLimitError } from "@/lib/viem-errors";
import Modal from "@/components/Modal";
import { ReceiptPopUp, ReceiptData } from "@/components/ReceiptPopUp";
import { useActiveChain } from "@/hooks/useActiveChain";

// Token rates: how many tokens equal 1 USD
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

const MULTI_FEE_MULTIPLIER = 1.005;
const MULTI_VALUE_EPSILON = 1e-6;

// Convert token amount to USD value
const toUsdValue = (amount: number, tokenSymbol: string): number => {
  const rate = TOKEN_RATES[tokenSymbol] || 1;
  return amount / rate;
};

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

interface TransactionPopupProps {
  payload: PaymentRequestPayload;
  onCancel: () => void;
}

interface PaymentQuote {
  baseAmount: bigint;
  platformFee: bigint;
  swapFee: bigint;
  totalRequired: bigint;
}

interface TokenPaymentEntry {
  id: string;
  currency: Currency;
  amount: string;
  balance: string;
}

export default function TransactionPopup({
  payload,
  onCancel,
}: TransactionPopupProps) {
  const { config } = useActiveChain();
  const currencies = useMemo(() => buildCurrencies(config), [config]);
  const [payToken, setPayToken] = useState<Currency>(currencies[0]!);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  // Receipt state
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Multi-token mode state
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [multiPayments, setMultiPayments] = useState<TokenPaymentEntry[]>([
    { id: "1", currency: currencies[0]!, amount: "", balance: "0" },
  ]);
  const [multiBalances, setMultiBalances] = useState<Record<string, string>>(
    {},
  );

  const feeToken = useMemo(
    () =>
      isMultiMode && multiPayments.length > 0
        ? multiPayments[0].currency
        : payToken,
    [isMultiMode, multiPayments, payToken],
  );

  // On-chain verification state for hybrid approach
  const [onChainTotalValue, setOnChainTotalValue] = useState<number | null>(
    null,
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null,
  );

  const {
    smartAccountAddress,
    payInvoice,
    payMultiTokenInvoice,
    isLoading,
    isReady,
    status,
    error,
  } = useSmartAccount();

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
    const defaultToken =
      currencies.find(
        (token) =>
          token.symbol.toLowerCase() ===
          config.defaultTokenSymbol.toLowerCase(),
      ) ?? currencies[0];
    setPayToken(defaultToken);
    setMultiPayments([{ id: "1", currency: defaultToken, amount: "", balance: "0" }]);
  }, [config.defaultTokenSymbol, currencies]);

  const processorAddress =
    payload.processor && payload.processor !== "0x0"
      ? (payload.processor as `0x${string}`)
      : (config.paymentProcessorAddress as `0x${string}`);

  // Find requested currency
  const requestedCurrency = currencies.find(
    (c) =>
      c.tokenAddress.toLowerCase() ===
      payload.request.requestedToken.toLowerCase(),
  );

  const requestedAmount = requestedCurrency
    ? Number(
      formatUnits(
        BigInt(payload.request.requestedAmountRaw),
        requestedCurrency.decimals,
      ),
    )
    : 0;

  // Fetch payment quote when fee token changes
  useEffect(() => {
    const fetchQuote = async () => {
      setIsLoadingQuote(true);
      setQuoteError(null);

      try {
        const breakdown = (await publicClient.readContract({
          address: processorAddress,
          abi: PAYMENT_PROCESSOR_ABI,
          functionName: "calculatePaymentCost",
          args: [
            payload.request.requestedToken as `0x${string}`,
            BigInt(payload.request.requestedAmountRaw),
            feeToken.tokenAddress as `0x${string}`,
          ],
        })) as
          | {
            baseAmount: bigint;
            platformFee: bigint;
            swapFee: bigint;
            totalRequired: bigint;
          }
          | [bigint, bigint, bigint, bigint];

        const [baseAmount, platformFee, swapFee, totalRequired] = Array.isArray(
          breakdown,
        )
          ? breakdown
          : [
            breakdown.baseAmount,
            breakdown.platformFee,
            breakdown.swapFee,
            breakdown.totalRequired,
          ];

        setQuote({
          baseAmount: BigInt(baseAmount || 0),
          platformFee: BigInt(platformFee || 0),
          swapFee: BigInt(swapFee || 0),
          totalRequired: BigInt(totalRequired || 0),
        });
      } catch (err) {
        console.error("Quote error:", err);
        setQuoteError("Failed to calculate payment cost");
        setErrorModal({
          isOpen: true,
          title: "Quote Error",
          message:
            err instanceof Error
              ? err.message
              : "Failed to calculate payment cost",
        });
      } finally {
        setIsLoadingQuote(false);
      }
    };

    fetchQuote();
  }, [feeToken, payload, publicClient, processorAddress]);

  // Fetch balance of payToken
  useEffect(() => {
    const fetchBalance = async () => {
      if (!smartAccountAddress) {
        setBalance("0");
        return;
      }

      setIsLoadingBalance(true);
      try {
        const rawBalance = await publicClient.readContract({
          address: payToken.tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [smartAccountAddress],
        });
        setBalance(formatUnits(rawBalance as bigint, payToken.decimals));
      } catch (err) {
        console.error("Failed to fetch balance:", err);
        setBalance("0");
        if (isNoDataContractError(err) || isRateLimitError(err)) {
          return;
        }
        setErrorModal({
          isOpen: true,
          title: "Balance Error",
          message:
            err instanceof Error ? err.message : "Failed to fetch balance",
        });
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [smartAccountAddress, payToken, publicClient]);

  // Check if balance is sufficient
  const numBalance = parseFloat(balance) || 0;
  const requiredAmount = quote
    ? Number(formatUnits(quote.totalRequired, feeToken.decimals))
    : 0;
  const hasInsufficientBalance = !!quote && requiredAmount > numBalance;
  const hasNoBalance = numBalance === 0;

  // Multi-token helpers
  const addPaymentEntry = () => {
    const availableCurrencies = currencies.filter(
      (c) =>
        !multiPayments.some((p) => p.currency.tokenAddress === c.tokenAddress),
    );
    if (availableCurrencies.length === 0) return;
    setMultiPayments([
      ...multiPayments,
      {
        id: Date.now().toString(),
        currency: availableCurrencies[0],
        amount: "",
        balance: multiBalances[availableCurrencies[0].tokenAddress] || "0",
      },
    ]);
  };

  const removePaymentEntry = (id: string) => {
    if (multiPayments.length <= 1) return;
    setMultiPayments(multiPayments.filter((p) => p.id !== id));
  };

  const updatePaymentEntry = (
    id: string,
    field: "currency" | "amount",
    value: Currency | string,
  ) => {
    setMultiPayments(
      multiPayments.map((p) =>
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

  // Fetch balances for multi-token mode
  useEffect(() => {
    if (!smartAccountAddress || !isMultiMode) return;

    const fetchMultiBalances = async () => {
      const balances: Record<string, string> = {};
      for (const currency of currencies) {
        try {
          const rawBalance = await publicClient.readContract({
            address: currency.tokenAddress as `0x${string}`,
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
      setMultiPayments((prev) =>
        prev.map((p) => ({
          ...p,
          balance: balances[p.currency.tokenAddress] || "0",
        })),
      );
    };

    fetchMultiBalances();
  }, [smartAccountAddress, isMultiMode, publicClient]);

  // Check multi-token balance sufficiency
  const hasMultiInsufficientBalance = useMemo(() => {
    return multiPayments.some((p) => {
      const amt = parseFloat(p.amount) || 0;
      const bal = parseFloat(p.balance) || 0;
      return amt > 0 && amt > bal;
    });
  }, [multiPayments]);

  // Calculate total USD value of multi-token payments
  const multiTotalUsdValue = useMemo(() => {
    return multiPayments.reduce((sum, p) => {
      const amt = parseFloat(p.amount) || 0;
      return sum + toUsdValue(amt, p.currency.symbol);
    }, 0);
  }, [multiPayments]);

  const multiRequiredTotal = useMemo(
    () => requestedAmount * MULTI_FEE_MULTIPLIER,
    [requestedAmount],
  );

  const multiEstimatedTotal = useMemo(() => {
    if (!requestedCurrency) return 0;
    return multiTotalUsdValue * (TOKEN_RATES[requestedCurrency.symbol] || 1);
  }, [multiTotalUsdValue, requestedCurrency]);

  const multiCurrentTotal = useMemo(
    () => onChainTotalValue ?? multiEstimatedTotal,
    [onChainTotalValue, multiEstimatedTotal],
  );

  // Check if multi-payment total covers required amount (estimate/on-chain)
  const hasMultiInsufficientValue =
    multiCurrentTotal > 0 &&
    multiCurrentTotal < multiRequiredTotal - MULTI_VALUE_EPSILON;

  const hasMultiExcessValue =
    multiCurrentTotal > multiRequiredTotal + MULTI_VALUE_EPSILON;

  const multiOverage = Math.max(0, multiCurrentTotal - multiRequiredTotal);

  // Fill remaining amount for a specific token entry
  const fillRemainingAmount = useCallback(
    (entryId: string) => {
      if (!requestedCurrency) return;

      // Calculate current total from other entries (excluding the target entry)
      const otherEntriesTotal = multiPayments
        .filter((p) => p.id !== entryId)
        .reduce((sum, p) => {
          const amt = parseFloat(p.amount) || 0;
          return sum + toUsdValue(amt, p.currency.symbol);
        }, 0);

      // Calculate how much USD value is still needed
      const otherEntriesInRequested =
        otherEntriesTotal * (TOKEN_RATES[requestedCurrency.symbol] || 1);
      const remainingNeeded = multiRequiredTotal - otherEntriesInRequested;

      if (remainingNeeded <= 0) return;

      // Find the target entry and calculate amount in that token
      const targetEntry = multiPayments.find((p) => p.id === entryId);
      if (!targetEntry) return;

      const targetRate = TOKEN_RATES[targetEntry.currency.symbol] || 1;
      const requestedRate = TOKEN_RATES[requestedCurrency.symbol] || 1;

      // Convert remaining needed to target token
      const amountInTargetToken =
        (remainingNeeded / requestedRate) * targetRate;

      // Check balance limit
      const balance = parseFloat(targetEntry.balance) || 0;
      const finalAmount = Math.min(amountInTargetToken, balance);

      // Update the entry with calculated amount
      setMultiPayments((prev) =>
        prev.map((p) =>
          p.id === entryId ? { ...p, amount: finalAmount.toFixed(6) } : p,
        ),
      );
    },
    [multiPayments, requestedCurrency, multiRequiredTotal],
  );

  // On-chain verification effect (Optimistic UI: verify in background)
  useEffect(() => {
    if (!isMultiMode || !requestedCurrency) return;

    const paymentsWithAmount = multiPayments.filter(
      (p) => parseFloat(p.amount) > 0,
    );
    if (paymentsWithAmount.length === 0) {
      setOnChainTotalValue(null);
      setVerificationError(null);
      return;
    }

    // Debounce: wait 1 second after user stops typing
    const timer = setTimeout(async () => {
      setIsVerifying(true);
      setVerificationError(null);

      try {
        let totalInRequestedToken = 0n;
        const requestedTokenDecimals = requestedCurrency.decimals;

        for (const payment of paymentsWithAmount) {
          const amountRaw = parseUnits(
            payment.amount,
            payment.currency.decimals,
          );

          if (
            payment.currency.tokenAddress === requestedCurrency.tokenAddress
          ) {
            // Same token, no conversion needed
            totalInRequestedToken += amountRaw;
          } else {
            // Convert via StablecoinRegistry
            const converted = (await publicClient.readContract({
              address: config.stablecoinRegistryAddress,
              abi: STABLECOIN_REGISTRY_ABI,
              functionName: "convert",
              args: [
                payment.currency.tokenAddress as Address,
                requestedCurrency.tokenAddress as Address,
                amountRaw,
              ],
            })) as bigint;
            totalInRequestedToken += converted;
          }
        }

        // Convert to number for display
        const totalNumber = Number(
          formatUnits(totalInRequestedToken, requestedTokenDecimals),
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
  }, [multiPayments, isMultiMode, requestedCurrency, publicClient]);

  // Calculate shortfall in each token used (for user-friendly display)
  const shortfallOptions = useMemo(() => {
    if (!requestedCurrency) return [];

    // Calculate shortfall in requested token units
    const requiredTotal = multiRequiredTotal; // Include 0.5% buffer for fees
    const currentTotal = multiCurrentTotal;

    if (currentTotal >= requiredTotal - MULTI_VALUE_EPSILON) return [];

    const shortfallInRequested = requiredTotal - currentTotal;

    // Calculate how much of each token used would cover the shortfall
    return multiPayments
      .filter((p) => parseFloat(p.amount) > 0)
      .map((p) => {
        const rate = TOKEN_RATES[p.currency.symbol] || 1;
        const requestedRate = TOKEN_RATES[requestedCurrency.symbol] || 1;
        const shortfallInThisToken =
          (shortfallInRequested / requestedRate) * rate;
        const currentAmount = parseFloat(p.amount) || 0;
        const nextAmount = currentAmount + shortfallInThisToken;
        return {
          symbol: p.currency.symbol,
          amount: shortfallInThisToken,
          currentAmount,
          nextAmount,
        };
      });
  }, [multiPayments, multiCurrentTotal, multiRequiredTotal, requestedCurrency]);

  const overageOptions = useMemo(() => {
    if (!requestedCurrency) return [];

    const overageInRequested = multiCurrentTotal - multiRequiredTotal;
    if (overageInRequested <= MULTI_VALUE_EPSILON) return [];

    return multiPayments
      .filter((p) => parseFloat(p.amount) > 0)
      .map((p) => {
        const rate = TOKEN_RATES[p.currency.symbol] || 1;
        const requestedRate = TOKEN_RATES[requestedCurrency.symbol] || 1;
        const overageInThisToken = (overageInRequested / requestedRate) * rate;
        const currentAmount = parseFloat(p.amount) || 0;
        const nextAmount = Math.max(0, currentAmount - overageInThisToken);
        return {
          symbol: p.currency.symbol,
          amount: overageInThisToken,
          currentAmount,
          nextAmount,
        };
      });
  }, [multiPayments, multiCurrentTotal, multiRequiredTotal, requestedCurrency]);

  const handleSend = async () => {
    if (!smartAccountAddress) return;

    const request = {
      recipient: payload.request.recipient as `0x${string}`,
      requestedToken: payload.request.requestedToken as `0x${string}`,
      requestedAmount: BigInt(payload.request.requestedAmountRaw),
      deadline: BigInt(payload.request.deadline),
      nonce: payload.request.nonce as `0x${string}`,
      merchantSigner: payload.request.merchantSigner as `0x${string}`,
    };

    try {
      let txHash: string;

      if (isMultiMode) {
        // Multi-token payment
        const payments = multiPayments
          .filter((p) => parseFloat(p.amount) > 0)
          .map((p) => ({
            token: p.currency.tokenAddress as Address,
            amount: parseUnits(p.amount, p.currency.decimals),
          }));

        if (payments.length === 0) {
          throw new Error("Add at least one payment amount");
        }

        txHash = await payMultiTokenInvoice({
          request,
          merchantSignature: payload.signature as `0x${string}`,
          payments,
          paymentProcessorAddress: processorAddress,
        });

        setReceipt({
          id: txHash,
          type: "send",
          status: "success",
          timestamp: new Date(),
          amount: requestedAmount,
          currency: requestedCurrency?.symbol || "Token",
          currencyIcon: requestedCurrency?.icon || "",
          toAddress: payload.request.recipient,
          txHash: txHash,
        });
      } else {
        // Single-token payment (original logic)
        if (!quote) return;

        const slippageBps = 100;
        const maxAmountToPay =
          (quote.totalRequired * BigInt(10000 + slippageBps)) / 10000n;

        txHash = await payInvoice({
          request,
          merchantSignature: payload.signature as `0x${string}`,
          payToken: payToken.tokenAddress as `0x${string}`,
          totalRequired: quote.totalRequired,
          maxAmountToPay,
          paymentProcessorAddress: processorAddress,
        });

        setReceipt({
          id: txHash,
          type: "send",
          status: "success",
          timestamp: new Date(),
          amount: Number(formatUnits(quote.totalRequired, payToken.decimals)),
          currency: payToken.symbol,
          currencyIcon: payToken.icon,
          toAddress: payload.request.recipient,
          txHash: txHash,
        });
      }

      setShowReceipt(true);
    } catch (err) {
      console.error("Payment error:", err);
      setReceipt({
        id: Date.now().toString(),
        type: "send",
        status: "failed",
        timestamp: new Date(),
        amount: requestedAmount,
        currency: requestedCurrency?.symbol || "Token",
        currencyIcon: requestedCurrency?.icon || "",
        toAddress: payload.request.recipient,
        errorMessage: err instanceof Error ? err.message : "Payment failed",
      });
      setShowReceipt(true);
    }
  };

  const shortenAddress = (addr: string) => {
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatQuoteAmount = (value: bigint) => {
    return Number(formatUnits(value, feeToken.decimals)).toLocaleString(
      undefined,
      {
        maximumFractionDigits: 6,
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-zinc-800 rounded-2xl p-4 sm:p-6 border-2 border-primary">
        <h2 className="text-white text-lg sm:text-xl font-bold text-center mb-4 sm:mb-6">
          Payment Details
        </h2>

        {/* Connection Warning - only show after isReady */}
        {isReady && !smartAccountAddress && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-400 text-sm text-center">
            Connect wallet to make payment
          </div>
        )}

        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-zinc-400">Transaction</span>
            <span className="text-white font-medium">Send Payment</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Send to</span>
            <span className="text-white font-mono">
              {shortenAddress(payload.request.recipient)}
            </span>
          </div>

          {/* Payment Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-zinc-700/50 rounded-lg">
            <span className="text-zinc-300 text-sm">Payment Mode</span>
            <div className="flex gap-2">
              <button
                onClick={() => setIsMultiMode(false)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${!isMultiMode
                  ? "bg-primary text-black font-medium"
                  : "bg-zinc-600 text-zinc-300 hover:bg-zinc-500"
                  }`}
              >
                Single
              </button>
              <button
                onClick={() => setIsMultiMode(true)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${isMultiMode
                  ? "bg-primary text-black font-medium"
                  : "bg-zinc-600 text-zinc-300 hover:bg-zinc-500"
                  }`}
              >
                Multi
              </button>
            </div>
          </div>

          {/* Single Token Mode */}
          {!isMultiMode && (
            <div className="space-y-2">
              <span className="text-zinc-400">Pay with</span>
              <CurrencyDropdown value={payToken} onChange={setPayToken} />
            </div>
          )}

          {/* Multi Token Mode */}
          {isMultiMode && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Pay with multiple tokens</span>
                <button
                  onClick={addPaymentEntry}
                  disabled={multiPayments.length >= currencies.length}
                  className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" /> Add Token
                </button>
              </div>

              {multiPayments.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="bg-zinc-700/30 p-3 rounded-lg space-y-2"
                >
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex-1 min-w-0 basis-full sm:basis-auto">
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
                      className="w-24 p-2 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-right focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => fillRemainingAmount(entry.id)}
                      className="px-2 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      title="Fill remaining amount"
                    >
                      <Zap className="w-3 h-3" />
                      Fill
                    </button>
                    {multiPayments.length > 1 && (
                      <button
                        onClick={() => removePaymentEntry(entry.id)}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {idx === 0 && (
                    <div className="text-xs text-primary/80">Gas fee token</div>
                  )}
                </div>
              ))}

              {/* Multi-token balance info */}
              <div className="text-xs text-zinc-500 space-y-1">
                {multiPayments.map((entry) => (
                  <div key={entry.id} className="flex justify-between">
                    <span>{entry.currency.symbol} Balance:</span>
                    <span>
                      {parseFloat(entry.balance).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Hybrid Verification Summary */}
              {multiPayments.some((p) => parseFloat(p.amount) > 0) && (
                <div className="p-3 bg-zinc-700/30 rounded-lg space-y-2 mt-2">
                  {/* Your Total in Requested Token */}
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">
                      Your Total ({requestedCurrency?.symbol})
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
                          {multiEstimatedTotal.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}
                          <span className="text-zinc-500 text-xs ml-1">
                            (est)
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Required Amount */}
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Required (incl. fees)</span>
                    <span className="text-white font-medium">
                      {multiRequiredTotal.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{" "}
                      {requestedCurrency?.symbol}
                    </span>
                  </div>

                  {/* Verification Error */}
                  {verificationError && (
                    <div className="text-xs text-orange-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {verificationError} - using estimate
                    </div>
                  )}

                  {/* Shortfall Warning with Options */}
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

                  {hasMultiExcessValue && (
                    <div className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg">
                      <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        Amount exceeds required total
                      </div>
                      <div className="text-xs text-red-300 space-y-0.5">
                        {overageOptions.map((opt, idx) => (
                          <div key={opt.symbol}>
                            {idx > 0 && (
                              <span className="text-red-400/70">or </span>
                            )}
                            <span className="font-mono">
                              -
                              {opt.amount.toLocaleString(undefined, {
                                maximumFractionDigits: 6,
                              })}
                            </span>
                            <span className="ml-1">{opt.symbol}</span>
                            <span className="ml-1 text-red-400/80">
                              (
                              {opt.nextAmount.toLocaleString(undefined, {
                                maximumFractionDigits: 6,
                              })}{" "}
                              {opt.symbol})
                            </span>
                          </div>
                        ))}
                        {overageOptions.length === 0 && (
                          <div>
                            Reduce by ~
                            {multiOverage.toLocaleString(undefined, {
                              maximumFractionDigits: 6,
                            })}{" "}
                            {requestedCurrency?.symbol}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Success Indicator */}
                  {shortfallOptions.length === 0 &&
                    onChainTotalValue !== null &&
                    !hasMultiInsufficientValue &&
                    !hasMultiExcessValue && (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        Sufficient amount
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Requested currency</span>
            <div className="flex items-center gap-2">
              {requestedCurrency && (
                <Image
                  src={requestedCurrency.icon}
                  alt=""
                  width={20}
                  height={20}
                />
              )}
              <span className="text-white">
                {requestedCurrency?.symbol || "Token"}
              </span>
            </div>
          </div>

          <div className="flex justify-between">
            <span className="text-zinc-400">Requested Amount</span>
            <span>
              <span className="text-primary font-bold">
                {requestedAmount.toLocaleString()}
              </span>
              <span className="text-white ml-1">
                {requestedCurrency?.symbol}
              </span>
            </span>
          </div>

          {/* Quote Info */}
          {isLoadingQuote ? (
            <div className="flex items-center justify-center gap-2 text-zinc-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Calculating...
            </div>
          ) : quote ? (
            <div className="border-t border-zinc-700 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Swap Fee</span>
                <span className="text-zinc-300">
                  {formatQuoteAmount(quote.swapFee)} {feeToken.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">You Pay</span>
                <span>
                  <span className="text-primary font-bold">
                    {formatQuoteAmount(quote.totalRequired)}
                  </span>
                  <span className="text-white ml-1">{feeToken.symbol}</span>
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Status Message */}
        {isLoading && (
          <div className="mt-4 flex items-center justify-center gap-2 text-primary text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            {status}
          </div>
        )}

        {/* Insufficient Balance Warning - Single Mode */}
        {smartAccountAddress && !isMultiMode && hasInsufficientBalance && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-orange-500/20 border border-orange-500 rounded-lg text-orange-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Insufficient {payToken.symbol} balance. You have{" "}
              {numBalance.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
              {payToken.symbol}
            </span>
          </div>
        )}

        {/* Insufficient Balance Warning - Multi Mode */}
        {smartAccountAddress && isMultiMode && hasMultiInsufficientBalance && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-orange-500/20 border border-orange-500 rounded-lg text-orange-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Insufficient balance for one or more tokens</span>
          </div>
        )}

        {/* Balance Info - Single Mode */}
        {smartAccountAddress && !isMultiMode && !hasNoBalance && quote && (
          <div className="mt-2 text-xs text-zinc-400 text-right">
            Balance:{" "}
            {isLoadingBalance
              ? "..."
              : numBalance.toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })}{" "}
            {payToken.symbol}
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={handleSend}
            disabled={
              !smartAccountAddress ||
              isLoading ||
              isLoadingQuote ||
              (isMultiMode
                ? hasMultiInsufficientBalance ||
                hasMultiInsufficientValue ||
                hasMultiExcessValue ||
                multiPayments.every((p) => !parseFloat(p.amount))
                : !quote || hasInsufficientBalance)
            }
            className="w-full py-3 sm:py-4 bg-primary text-black font-bold text-base sm:text-lg md:text-xl rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "PROCESSING..."
              : isMultiMode
                ? hasMultiExcessValue
                  ? "AMOUNT TOO HIGH"
                  : hasMultiInsufficientBalance || hasMultiInsufficientValue
                    ? "INSUFFICIENT AMOUNT"
                    : "PAY WITH MULTI-TOKEN"
                : hasInsufficientBalance
                  ? "INSUFFICIENT AMOUNT"
                  : "PAY NOW"}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="w-full py-3 sm:py-4 border-2 border-primary text-primary font-bold text-base sm:text-lg md:text-xl rounded-xl hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            CANCEL
          </button>
        </div>
      </div>

      {/* Error Modal */}
      <Modal
        id="payment-error-modal"
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

      {/* Receipt Popup */}
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
