import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPublicClient, http, type Address } from "viem";
import { ERC20_ABI, PAYMASTER_ABI } from "@/config/abi";
import { useActiveChain } from "@/hooks/useActiveChain";

export function useApprovalStatus(smartAccountAddress: Address | null) {
  const { config } = useActiveChain();
  const tokens = config.tokens;
  const paymasterAddress = config.paymasterAddress;
  const contextKey = `${config.key}:${smartAccountAddress ?? "none"}`;
  const contextRef = useRef(contextKey);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      }),
    [config],
  );
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [ethBalance, setEthBalance] = useState<bigint>(BigInt(0));

  useEffect(() => {
    contextRef.current = contextKey;
    setIsApproved(null);
    setIsChecking(Boolean(smartAccountAddress));
    setEthBalance(BigInt(0));
  }, [contextKey, smartAccountAddress, paymasterAddress]);

  const checkApproval = useCallback(
    async (showLoading = false) => {
      if (!smartAccountAddress) {
        setIsApproved(null);
        setEthBalance(BigInt(0));
        return;
      }
      if (showLoading) {
        setIsChecking(true);
      }
      try {
        // Check if all tokens are supported + approved to Paymaster
        const approvalChecks = await Promise.all(
          tokens.map(async (token) => {
            try {
              const supported = await publicClient.readContract({
                address: paymasterAddress,
                abi: PAYMASTER_ABI,
                functionName: "isSupportedToken",
                args: [token.address as Address],
              });
              const allowance = await publicClient.readContract({
                address: token.address as Address,
                abi: ERC20_ABI,
                functionName: "allowance",
                args: [smartAccountAddress, paymasterAddress],
              });
              return Boolean(supported) && (allowance as bigint) > BigInt(0);
            } catch {
              return null;
            }
          })
        );

        // Check ETH balance
        const balance = await publicClient.getBalance({
          address: smartAccountAddress,
        });
        if (contextRef.current === contextKey) {
          setEthBalance(balance);
        }

        const hasUnknown = approvalChecks.some((approved) => approved === null);
        const hasAllApprovals = approvalChecks.every((approved) => approved);
        if (contextRef.current === contextKey) {
          setIsApproved(hasUnknown ? null : hasAllApprovals);
        }
      } catch (err) {
        console.error("Failed to check approval status:", err);
        if (contextRef.current === contextKey) {
          setIsApproved(null);
        }
      } finally {
        if (showLoading) {
          setIsChecking(false);
        }
      }
    },
    [smartAccountAddress, publicClient, paymasterAddress, tokens, contextKey]
  );

  useEffect(() => {
    if (!smartAccountAddress) {
      setIsApproved(null);
      setEthBalance(BigInt(0));
      return;
    }

    checkApproval(true);
    const intervalId = setInterval(() => checkApproval(false), 7000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkApproval(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [smartAccountAddress, checkApproval]);

  return {
    isApproved,
    isChecking,
    ethBalance,
    refresh: checkApproval,
    contextKey,
  };
}
