"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { CurrencyDropdown, Currency, buildCurrencies } from "@/components/Currency";
import Modal from "@/components/Modal";
import { ReceiptPopUp, ReceiptData } from "@/components/ReceiptPopUp";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { useActiveChain } from "@/hooks/useActiveChain";
import {
  createPublicClient,
  http,
  formatUnits,
  getAddress,
  isAddress,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import { ERC20_ABI } from "@/config/abi";
import { isNoDataContractError, isRateLimitError } from "@/lib/viem-errors";

const isEnsName = (value: string) => {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 && !trimmed.startsWith("0x") && trimmed.includes(".")
  );
};

const resolveRecipientAddress = async (
  value: string,
  ensClient: ReturnType<typeof createPublicClient>,
): Promise<Address> => {
  const trimmed = value.trim();
  if (isAddress(trimmed)) {
    return getAddress(trimmed) as Address;
  }
  if (!isEnsName(trimmed)) {
    throw new Error("Invalid address or ENS name");
  }
  const resolved = await ensClient.getEnsAddress({
    name: trimmed.toLowerCase(),
    gatewayUrls: ["https://ccip-v3.ens.xyz"],
  });
  if (!resolved) {
    throw new Error(`ENS name not found: ${trimmed}`);
  }
  return resolved;
};

interface SendFormData {
  currency: Currency;
  address: string;
  amount: number;
}

interface InputAddressContentProps {
  onSend?: (data: SendFormData) => void;
}

interface BatchRecipient {
  id: string;
  address: string;
  amount: string;
}

export default function InputAddressContent({
  onSend,
}: InputAddressContentProps) {
  const { config } = useActiveChain();
  const currencies = useMemo(() => buildCurrencies(config), [config]);
  const [currency, setCurrency] = useState<Currency>(currencies[0]!);
  const [address, setAddress] = useState("");
  const [amountInput, setAmountInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balance, setBalance] = useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchRecipients, setBatchRecipients] = useState<BatchRecipient[]>([
    { id: "1", address: "", amount: "" },
  ]);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  // Receipt states
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const {
    smartAccountAddress,
    isReady,
    sendGaslessTransfer,
    sendBatchTransfer,
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

  const ensPublicClient = useMemo(
    () =>
      createPublicClient({
        chain: mainnet,
        transport: config.mainnetRpcUrl ? http(config.mainnetRpcUrl) : http(),
        ccipRead: {},
      }),
    [config.mainnetRpcUrl],
  );

  useEffect(() => {
    if (currencies.length === 0) return;
    const defaultCurrency =
      currencies.find(
        (token) =>
          token.symbol.toLowerCase() ===
          config.defaultTokenSymbol.toLowerCase(),
      ) ?? currencies[0];
    setCurrency(defaultCurrency);
  }, [config.defaultTokenSymbol, currencies]);

  const fetchBalance = useCallback(async () => {
    if (!smartAccountAddress) {
      setBalance("0");
      return;
    }

    setIsLoadingBalance(true);
    try {
      const rawBalance = await publicClient.readContract({
        address: currency.tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [smartAccountAddress],
      });
      setBalance(formatUnits(rawBalance as bigint, currency.decimals));
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
  }, [smartAccountAddress, currency, publicClient]);

  // Fetch balance when currency or address changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Check balance
  const numBalance = parseFloat(balance) || 0;
  const numAmount = parseFloat(amountInput);

  const estimatedFee = useMemo(() => {
    return Number.isFinite(numAmount) ? numAmount * 0.005 : 0;
  }, [numAmount]);

  const totalRequired = useMemo(() => {
    return Number.isFinite(numAmount) ? numAmount + numAmount * 0.005 : 0;
  }, [numAmount]);
  const hasInsufficientBalance = totalRequired > 0 && totalRequired > numBalance;
  const hasNoBalance = numBalance === 0;

  // Calculate batch total
  const batchTotal = useMemo(() => {
    return batchRecipients.reduce((sum, r) => {
      const amt = parseFloat(r.amount) || 0;
      return sum + amt;
    }, 0);
  }, [batchRecipients]);

  const batchEstimatedFee = useMemo(() => {
    return batchTotal * 0.005;
  }, [batchTotal]);

  const batchTotalRequired = useMemo(() => {
    return batchTotal + batchEstimatedFee;
  }, [batchTotal, batchEstimatedFee]);

  const hasBatchInsufficientBalance =
    batchTotal > 0 && batchTotalRequired > numBalance;

  // Add recipient row
  const addRecipient = useCallback(() => {
    if (batchRecipients.length >= 20) return; // Max 20 recipients
    setBatchRecipients((prev) => [
      ...prev,
      { id: Date.now().toString(), address: "", amount: "" },
    ]);
  }, [batchRecipients.length]);

  // Remove recipient row
  const removeRecipient = useCallback((id: string) => {
    setBatchRecipients((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Update recipient field
  const updateRecipient = useCallback(
    (id: string, field: "address" | "amount", value: string) => {
      setBatchRecipients((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
              ...r,
              [field]:
                field === "amount" ? value.replace(/[^0-9.]/g, "") : value,
            }
            : r,
        ),
      );
    },
    [],
  );

  // Validate batch recipients
  const batchValidationErrors = useMemo(() => {
    const errors: string[] = [];
    const addresses: string[] = [];

    batchRecipients.forEach((r, idx) => {
      // Check address
      if (r.address.trim()) {
        const trimmed = r.address.trim();
        if (isAddress(trimmed)) {
          const normalized = trimmed.toLowerCase();
          if (addresses.includes(normalized)) {
            errors.push(`Duplicate address at row ${idx + 1}`);
          }
          addresses.push(normalized);
        } else if (!isEnsName(trimmed)) {
          errors.push(`Invalid address or ENS name at row ${idx + 1}`);
        }
      }

      // Check amount
      const amt = parseFloat(r.amount);
      if (r.amount && (!Number.isFinite(amt) || amt <= 0)) {
        errors.push(`Invalid amount at row ${idx + 1}`);
      }
    });

    return errors;
  }, [batchRecipients]);

  const hasBatchValidRecipients = batchRecipients.some(
    (r) => r.address.trim() && parseFloat(r.amount) > 0,
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!address.trim()) {
        setErrorModal({
          isOpen: true,
          title: "Validation Error",
          message: "Please enter an address",
        });
        return;
      }

      const amountValue = Number.isFinite(numAmount) ? numAmount : 0;
      if (amountValue <= 0) {
        setErrorModal({
          isOpen: true,
          title: "Validation Error",
          message: "Please enter a valid amount",
        });
        return;
      }

      if (hasInsufficientBalance) {
        return;
      }

      let recipient: Address;
      try {
        recipient = await resolveRecipientAddress(address, ensPublicClient);
      } catch (err) {
        setErrorModal({
          isOpen: true,
          title: "Validation Error",
          message: err instanceof Error ? err.message : "Invalid address",
        });
        return;
      }

      setIsSubmitting(true);

      try {
        if (onSend) {
          await onSend({ currency, address: recipient, amount: amountValue });
        } else {
          const txHash = await sendGaslessTransfer({
            recipient,
            amount: amountValue.toString(),
            tokenAddress: currency.tokenAddress as Address,
            decimals: currency.decimals,
          });
          setReceipt({
            id: txHash,
            type: "send",
            status: "success",
            timestamp: new Date(),
            amount: amountValue,
            currency: currency.symbol,
            currencyIcon: currency.icon,
            toAddress: recipient,
            txHash: txHash,
          });
          setShowReceipt(true);
          await fetchBalance();
          setAddress("");
          setAmountInput("");
        }
      } catch (error) {
        console.error("Send error:", error);
        // Show failure receipt
        setReceipt({
          id: Date.now().toString(),
          type: "send",
          status: "failed",
          timestamp: new Date(),
          amount: amountValue,
          currency: currency.symbol,
          currencyIcon: currency.icon,
          toAddress: address,
          errorMessage:
            error instanceof Error ? error.message : "Transaction failed",
        });
        setShowReceipt(true);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      currency,
      address,
      numAmount,
      onSend,
      hasInsufficientBalance,
      sendGaslessTransfer,
      fetchBalance,
    ],
  );

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    const sanitized = value.replace(/^(\d*\.\d*).*$/, "$1");
    setAmountInput(sanitized);
  };

  const handleBatchSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (batchValidationErrors.length > 0) {
        setErrorModal({
          isOpen: true,
          title: "Validation Error",
          message: batchValidationErrors.join("\n"),
        });
        return;
      }

      if (!hasBatchValidRecipients) {
        setErrorModal({
          isOpen: true,
          title: "Validation Error",
          message: "Please add at least one recipient with address and amount",
        });
        return;
      }

      if (hasBatchInsufficientBalance) {
        return;
      }

      setIsSubmitting(true);

      try {
        const recipientInputs = batchRecipients
          .map((r, idx) => ({ ...r, index: idx }))
          .filter((r) => r.address.trim() && parseFloat(r.amount) > 0);

        const resolvedRecipients = await Promise.all(
          recipientInputs.map(async (r) => {
            try {
              const resolvedAddress = await resolveRecipientAddress(
                r.address,
                ensPublicClient,
              );
              return { ...r, resolvedAddress };
            } catch (err) {
              const message =
                err instanceof Error ? err.message : "Invalid address";
              throw new Error(`Row ${r.index + 1}: ${message}`);
            }
          }),
        );

        const seen = new Set<string>();
        const duplicateErrors: string[] = [];
        resolvedRecipients.forEach((r) => {
          const key = r.resolvedAddress.toLowerCase();
          if (seen.has(key)) {
            duplicateErrors.push(`Duplicate address at row ${r.index + 1}`);
          } else {
            seen.add(key);
          }
        });

        if (duplicateErrors.length > 0) {
          setErrorModal({
            isOpen: true,
            title: "Validation Error",
            message: duplicateErrors.join("\n"),
          });
          return;
        }

        const validRecipients = resolvedRecipients.map((r) => ({
          address: r.resolvedAddress as Address,
          amount: r.amount,
        }));

        const result = await sendBatchTransfer({
          recipients: validRecipients,
          tokenAddress: currency.tokenAddress as Address,
          decimals: currency.decimals,
        });

        // Show success receipt
        setReceipt({
          id: result.txHash,
          type: "send",
          status: "success",
          timestamp: new Date(),
          amount: batchTotal,
          currency: currency.symbol,
          currencyIcon: currency.icon,
          toAddress: `${result.recipientCount} recipients`,
          txHash: result.txHash,
        });
        setShowReceipt(true);
        await fetchBalance();
        // Reset batch form
        setBatchRecipients([{ id: "1", address: "", amount: "" }]);
      } catch (error) {
        console.error("Batch send error:", error);
        setReceipt({
          id: Date.now().toString(),
          type: "send",
          status: "failed",
          timestamp: new Date(),
          amount: batchTotal,
          currency: currency.symbol,
          currencyIcon: currency.icon,
          toAddress: `${batchRecipients.length} recipients`,
          errorMessage:
            error instanceof Error ? error.message : "Batch transaction failed",
        });
        setShowReceipt(true);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      batchRecipients,
      batchTotal,
      batchTotalRequired,
      batchValidationErrors,
      hasBatchValidRecipients,
      hasBatchInsufficientBalance,
      currency,
      sendBatchTransfer,
      fetchBalance,
    ],
  );

  return (
    <div className="p-4">
      {/* Connect wallet message */}
      {isReady && !smartAccountAddress && (
        <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500 rounded-lg text-yellow-400 text-sm text-center">
          Connect wallet to send tokens
        </div>
      )}

      <form
        onSubmit={isBatchMode ? handleBatchSubmit : handleSubmit}
        className="space-y-6"
      >
        {/* Send As (Currency Dropdown) */}
        <div className="space-y-2">
          <label className="text-white font-medium">Send as</label>
          <CurrencyDropdown value={currency} onChange={setCurrency} />
        </div>

        {/* Batch Transfer Toggle */}
        <div className="flex items-center justify-between p-3 bg-zinc-800/50 border border-zinc-700 rounded-xl">
          <div className="text-sm">
            <span className="text-white font-medium">Batch Transfer</span>
            <span className="text-zinc-400 ml-2">
              (Send to multiple recipients)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsBatchMode(!isBatchMode);
              if (!isBatchMode) {
                setAddress("");
                setAmountInput("");
              } else {
                setBatchRecipients([{ id: "1", address: "", amount: "" }]);
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isBatchMode
              ? "bg-primary text-black"
              : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
          >
            {isBatchMode ? "ON" : "OFF"}
          </button>
        </div>

        {isBatchMode ? (
          <div className="space-y-4">
            {/* Batch Recipients List */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-white font-medium">Recipients</label>
                <span className="text-xs text-zinc-400">
                  {batchRecipients.length}/20 recipients
                </span>
              </div>

              {batchRecipients.map((recipient, idx) => (
                <div
                  key={recipient.id}
                  className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700 space-y-2"
                >
                  {/* Row number + Address */}
                  <div className="flex gap-2 items-center">
                    <span className="text-zinc-500 text-sm w-6 shrink-0">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={recipient.address}
                      onChange={(e) =>
                        updateRecipient(
                          recipient.id,
                          "address",
                          e.target.value,
                        )
                      }
                      placeholder="0x... or name.base.eth"
                      className="flex-1 p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-primary min-w-0"
                    />
                  </div>
                  {/* Amount field */}
                  <div className="ml-8">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={recipient.amount}
                      onChange={(e) =>
                        updateRecipient(
                          recipient.id,
                          "amount",
                          e.target.value,
                        )
                      }
                      placeholder="Amount"
                      className="w-full p-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white text-sm text-right placeholder-zinc-500 focus:outline-none focus:border-primary"
                    />
                  </div>
                  {/* Delete button - full width below amount */}
                  {batchRecipients.length > 1 && (
                    <div className="ml-8">
                      <button
                        type="button"
                        onClick={() => removeRecipient(recipient.id)}
                        className="w-full py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors text-xs flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Add Recipient Button */}
              {batchRecipients.length < 20 && (
                <button
                  type="button"
                  onClick={addRecipient}
                  className="w-full py-3 border-2 border-dashed border-zinc-600 rounded-xl text-zinc-400 hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Recipient
                </button>
              )}
            </div>

            {/* Batch Summary */}
            <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Total Amount</span>
                <span className="text-white font-medium">
                  {batchTotal.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {currency.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Est. Fee (0.5%)</span>
                <span className="text-zinc-300">
                  ~
                  {batchEstimatedFee.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}{" "}
                  {currency.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-zinc-700 pt-2">
                <span className="text-zinc-400">Total Required</span>
                <span className="text-primary font-bold">
                  {batchTotalRequired.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {currency.symbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">
                  Your Balance ({currency.symbol})
                </span>
                <span
                  className={
                    hasBatchInsufficientBalance
                      ? "text-red-400"
                      : "text-green-400"
                  }
                >
                  {numBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {currency.symbol}
                </span>
              </div>
            </div>

            {/* Validation Errors */}
            {batchValidationErrors.length > 0 && (
              <div className="p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
                <div className="flex items-center gap-2 font-medium mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Validation Errors:
                </div>
                {batchValidationErrors.map((err, idx) => (
                  <div key={idx}>- {err}</div>
                ))}
              </div>
            )}

            {/* Batch Insufficient Balance Warning */}
            {hasBatchInsufficientBalance && (
              <div className="flex items-center gap-2 p-3 bg-orange-500/20 border border-orange-500 rounded-lg text-orange-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Insufficient balance. Need{" "}
                  {batchTotalRequired.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {currency.symbol}, have{" "}
                  {numBalance.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-white font-medium">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter wallet address or ENS"
                className="w-full p-3 sm:p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors text-sm sm:text-base"
              />
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-white font-medium">Amount</label>
                {smartAccountAddress && (
                  <span className="text-xs text-zinc-400">
                    Balance ({currency.symbol}):{" "}
                    {isLoadingBalance
                      ? "..."
                      : numBalance.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full p-3 sm:p-4 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition-colors text-sm sm:text-base"
              />
              {smartAccountAddress &&
                Number.isFinite(numAmount) &&
                numAmount > 0 && (
                  <div className="text-xs text-right text-zinc-500">
                    Est. Fee: ~
                    {estimatedFee.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    {currency.symbol} (0.5%)
                  </div>
                )}
            </div>

            {/* Insufficient Balance Warning */}
            {smartAccountAddress && hasInsufficientBalance && (
              <div className="flex items-center gap-2 p-3 bg-orange-500/20 border border-orange-500 rounded-lg text-orange-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Insufficient balance. Required:{" "}
                  {totalRequired.toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}{" "}
                  {currency.symbol} (incl. fee)
                </span>
              </div>
            )}

            {/* No Balance Warning */}
            {smartAccountAddress && hasNoBalance && amountInput === "" && (
              <div className="flex items-center gap-2 p-3 bg-zinc-700/50 border border-zinc-600 rounded-lg text-zinc-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>You don&apos;t have any {currency.symbol} tokens</span>
              </div>
            )}

            {/* Status Message */}
            {(isSubmitting || isLoading) && (
              <div className="flex items-center justify-center gap-2 text-primary text-sm">
                {status || "Sending..."}
              </div>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={
            isSubmitting ||
            isLoading ||
            !smartAccountAddress ||
            (isBatchMode
              ? hasBatchInsufficientBalance ||
              !hasBatchValidRecipients ||
              batchValidationErrors.length > 0
              : hasInsufficientBalance)
          }
          className={`w-full py-3 sm:py-4 font-bold text-base sm:text-lg md:text-xl rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${(isBatchMode ? hasBatchInsufficientBalance : hasInsufficientBalance)
            ? "bg-orange-500/50 text-orange-200"
            : "bg-primary text-black hover:bg-primary/90"
            }`}
        >
          {isSubmitting || isLoading
            ? "SENDING..."
            : (
              isBatchMode
                ? hasBatchInsufficientBalance
                : hasInsufficientBalance
            )
              ? "INSUFFICIENT BALANCE"
              : isBatchMode
                ? `SEND TO ${batchRecipients.filter((r) => r.address.trim() && parseFloat(r.amount) > 0).length} RECIPIENTS`
                : "SEND NOW"}
        </button>
      </form>

      {/* Error Modal */}
      <Modal
        id="send-error-modal"
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

      {/* Receipt Popup */}
      <ReceiptPopUp
        isOpen={showReceipt}
        data={receipt}
        onClose={() => setShowReceipt(false)}
      />
    </div>
  );
}
