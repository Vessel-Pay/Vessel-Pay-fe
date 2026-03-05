"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { Eye, EyeOff, ChevronDown, Loader2 } from "lucide-react";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { useActiveChain } from "@/hooks/useActiveChain";
import { createPublicClient, http, formatUnits, type Address } from "viem";
import { ERC20_ABI } from "@/config/abi";
import Modal from "@/components/Modal";
import { isNoDataContractError, isRateLimitError } from "@/lib/viem-errors";

type TokenBalances = { [symbol: string]: string };

export default function BalanceDisplay() {
  const { smartAccountAddress } = useSmartAccount();
  const { config } = useActiveChain();
  const tokens = config.tokens;
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0);
  const [balances, setBalances] = useState<TokenBalances>({});
  const [isHidden, setIsHidden] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  const selectedToken = tokens[selectedTokenIndex];

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      }),
    [config],
  );

  useEffect(() => {
    if (tokens.length === 0) return;
    const defaultIndex = Math.max(
      tokens.findIndex(
        (token) =>
          token.symbol.toLowerCase() ===
          config.defaultTokenSymbol.toLowerCase(),
      ),
      0,
    );
    setSelectedTokenIndex(defaultIndex);
    setBalances({});
  }, [config.defaultTokenSymbol, tokens]);

  // Fetch all balances when address changes or dropdown opens
  const fetchAllBalances = async () => {
    if (!smartAccountAddress) return;

    setIsLoadingAll(true);
    const newBalances: TokenBalances = {};

    try {
      await Promise.all(
        tokens.map(async (token) => {
          try {
            const rawBalance = await publicClient.readContract({
              address: token.address as Address,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [smartAccountAddress],
            });
            newBalances[token.symbol] = formatUnits(
              rawBalance as bigint,
              token.decimals
            );
          } catch (err) {
            newBalances[token.symbol] = "0";
            // Don't show modal for individual token failures in batch
          }
        })
      );
      setBalances(newBalances);
    } finally {
      setIsLoadingAll(false);
    }
  };

  const fetchSelectedBalance = useCallback(async () => {
    if (!smartAccountAddress) {
      setBalances({});
      return;
    }

    setIsLoading(true);
    try {
      const rawBalance = await publicClient.readContract({
        address: selectedToken.address as Address,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [smartAccountAddress],
      });

      const formatted = formatUnits(
        rawBalance as bigint,
        selectedToken.decimals
      );
      setBalances((prev) => ({ ...prev, [selectedToken.symbol]: formatted }));
    } catch (err) {
      console.error("Failed to fetch balance:", err);
      setBalances((prev) => ({ ...prev, [selectedToken.symbol]: "0" }));
      if (isNoDataContractError(err) || isRateLimitError(err)) {
        return;
      }
      setErrorModal({
        isOpen: true,
        title: "Balance Error",
        message: err instanceof Error ? err.message : "Failed to fetch balance",
        onRetry: () => {
          setErrorModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [smartAccountAddress, selectedToken, publicClient]);

  // Fetch selected token balance on mount and when token changes
  useEffect(() => {
    fetchSelectedBalance();
  }, [fetchSelectedBalance]);

  // Auto-refresh selected token balance
  useEffect(() => {
    if (!smartAccountAddress) return;
    const interval = setInterval(() => {
      fetchSelectedBalance();
    }, 15000);
    return () => clearInterval(interval);
  }, [smartAccountAddress, fetchSelectedBalance]);

  // Fetch all balances when dropdown opens
  useEffect(() => {
    if (showDropdown && smartAccountAddress) {
      fetchAllBalances();
    }
  }, [showDropdown, smartAccountAddress]);

  // Don't show if not connected
  if (!smartAccountAddress) {
    return null;
  }

  const formatBalance = (bal: string | undefined) => {
    if (!bal) return "0";
    const num = parseFloat(bal);
    if (isHidden) return "****";

    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + "K";
    } else {
      return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
  };

  const displayBalance = () => {
    return formatBalance(balances[selectedToken.symbol]);
  };

  const handleTokenSelect = (index: number) => {
    setSelectedTokenIndex(index);
    setShowDropdown(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Balance with Token Selector */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <Image
          src={selectedToken.icon}
          alt={selectedToken.symbol}
          width={16}
          height={16}
          className="rounded-full"
        />
        <span className="text-white text-xs font-medium">
          {displayBalance()}
        </span>
        <span className="text-zinc-400 text-xs">{selectedToken.symbol}</span>
        <ChevronDown className="w-3 h-3 text-zinc-400" />
      </button>

      {/* Eye Toggle */}
      <button
        onClick={() => setIsHidden(!isHidden)}
        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
        title={isHidden ? "Show balance" : "Hide balance"}
      >
        {isHidden ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Token Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute top-full right-0 mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-48">
            {isLoadingAll && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 text-zinc-400 text-xs border-b border-zinc-700">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading balances...
              </div>
            )}
            {tokens.map((token, index) => (
              <button
                key={token.symbol}
                onClick={() => handleTokenSelect(index)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-zinc-700 transition-colors cursor-pointer ${index === selectedTokenIndex ? "bg-zinc-700" : ""
                  }`}
              >
                <div className="flex items-center gap-2">
                  <Image
                    src={token.icon}
                    alt={token.symbol}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                  <span className="text-white text-sm">{token.symbol}</span>
                </div>
                <span className="text-zinc-400 text-xs font-mono">
                  {formatBalance(balances[token.symbol])}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Error Modal */}
      <Modal
        id="balance-error-modal"
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
