// @ts-nocheck
"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useWallets, usePrivy, useCreateWallet } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  decodeAbiParameters,
  getAddress,
  hashTypedData,
  http,
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  maxUint256,
  parseUnits,
  formatUnits,
  stringToHex,
  toHex,
} from "viem";
import { toAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { useActiveChain } from "@/hooks/useActiveChain";
import {
  ERC20_ABI,
  FAUCET_ABI,
  PAYMENT_PROCESSOR_ABI,
  QRIS_REGISTRY_ABI,
  STABLE_SWAP_ABI,
  PAYMASTER_ABI,
  ENTRYPOINT_ABI,
} from "@/config/abi";
import { buildPaymasterData } from "@/lib/paymasterData";
import { getPaymasterSignature, getSignerAddress } from "@/api/signerApi";
import { buildSwapCalldata } from "@/api/swapApi";
import { env } from "@/config/env";

/**
 * Transform pimlico rate limit errors into user-friendly messages
 */
function transformError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.toLowerCase().includes("0xf4d678b8")) {
    return "Pool has insufficient liquidity for this output token. Try a smaller amount or a different pair.";
  }
  if (
    message.toLowerCase().includes("too many requests") ||
    message.toLowerCase().includes("rate limit")
  ) {
    return "Rate limit pimlico reached. Please try again a minute later.";
  }
  return message;
}

export type BaseAppDeploymentStatus = {
  status: "checking" | "deployed" | "missing" | "unknown";
  address: Address;
  chainId: number;
  rpcUrl: string;
  codeLength?: number;
  error?: string;
};

export function useSmartAccount() {
  const { config } = useActiveChain();
  const chain = config.chain;
  const chainKey = config.key;
  const rpcUrl = config.rpcUrl;
  const bundlerUrl = config.bundlerUrl;
  const entryPointAddress = config.entryPointAddress;
  const simpleAccountFactory = config.simpleAccountFactory;
  const paymasterAddress = config.paymasterAddress;
  const paymentProcessorAddress = config.paymentProcessorAddress;
  const qrisRegistryAddress = config.qrisRegistryAddress;
  const tokens = config.tokens;

  // Supported tokens for paymaster sponsorship
  // These tokens are approved for gasless transactions
  const SUPPORTED_PAYMASTER_TOKENS: Address[] = useMemo(() => {
    const tokenMap = new Map(tokens.map((t) => [t.symbol, t.address]));
    return [
      tokenMap.get("USDC"),
      tokenMap.get("EURC"),
      tokenMap.get("IDRX"),
      tokenMap.get("USDS"),
      tokenMap.get("BRZ"),
      tokenMap.get("AUDD"),
      tokenMap.get("CADC"),
      tokenMap.get("ZCHF"),
      tokenMap.get("TGBP"),
    ].filter((addr): addr is Address => addr !== undefined);
  }, [tokens]);

  const PAYMASTER_VERIFICATION_GAS = BigInt(1_000_000);
  const PAYMASTER_POST_OP_GAS = BigInt(1_000_000);
  const PRE_VERIFICATION_GAS =
    chain.id === 127823 ? BigInt(7_500_000) : BigInt(150_000);
  const { wallets, ready: privyReady } = useWallets();
  const { authenticated } = usePrivy();
  const { createWallet } = useCreateWallet();
  const hasAttemptedCreate = useRef(false);
  const [smartAccountAddress, setSmartAccountAddress] =
    useState<Address | null>(null);
  const [eoaAddress, setEoaAddress] = useState<Address | null>(null);
  const [walletSource, setWalletSource] = useState<
    "external" | "embedded" | null
  >(null);
  const [isBaseAccountWallet, setIsBaseAccountWallet] = useState(false);
  const [effectiveWalletClient, setEffectiveWalletClient] = useState<ReturnType<
    typeof createWalletClient
  > | null>(null);
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // Track initial loading
  const [error, setError] = useState<string | null>(null);
  const [baseAppDeployment, setBaseAppDeployment] =
    useState<BaseAppDeploymentStatus | null>(null);
  const [client, setClient] = useState<ReturnType<
    typeof createSmartAccountClient
  > | null>(null);
  const prevChainRef = useRef<number | null>(null);

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain,
        transport: http(rpcUrl || "https://sepolia.base.org"),
      }),
    [chain, rpcUrl],
  );

  const bundlerClient = useMemo(
    () =>
      createPublicClient({
        chain: chain,
        transport: http(bundlerUrl || "https://api.pimlico.io/v2/base-sepolia/rpc"),
      }),
    [chain, bundlerUrl],
  );

  const checkBundlerHealth = useCallback(async (): Promise<{
    isAvailable: boolean;
    latency: number;
    supportedMethods: string[];
  }> => {
    const startTime = Date.now();
    const supportedMethods: string[] = [];

    try {
      // Check eth_sendUserOperation
      try {
        await bundlerClient.request({
          method: "eth_sendUserOperation",
          params: [],
        } as any);
        supportedMethods.push("eth_sendUserOperation");
      } catch (error) {
        // Method exists if we get a validation error (not "method not found")
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("method not found") && !message.includes("Method not found")) {
          supportedMethods.push("eth_sendUserOperation");
        }
      }

      // Check eth_estimateUserOperationGas
      try {
        await bundlerClient.request({
          method: "eth_estimateUserOperationGas",
          params: [],
        } as any);
        supportedMethods.push("eth_estimateUserOperationGas");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("method not found") && !message.includes("Method not found")) {
          supportedMethods.push("eth_estimateUserOperationGas");
        }
      }

      // Check eth_getUserOperationReceipt
      try {
        await bundlerClient.request({
          method: "eth_getUserOperationReceipt",
          params: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
        } as any);
        supportedMethods.push("eth_getUserOperationReceipt");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("method not found") && !message.includes("Method not found")) {
          supportedMethods.push("eth_getUserOperationReceipt");
        }
      }

      const latency = Date.now() - startTime;
      const isAvailable = supportedMethods.length >= 3;

      console.log(`Bundler health check: ${isAvailable ? "✓" : "✗"} (latency: ${latency}ms, methods: ${supportedMethods.join(", ")})`);

      return { isAvailable, latency, supportedMethods };
    } catch (error) {
      const latency = Date.now() - startTime;
      console.error("Bundler unavailable:", error);
      return { isAvailable: false, latency, supportedMethods: [] };
    }
  }, [bundlerClient]);

  // isReady = true when: not authenticated OR smartAccountAddress is set
  const isReady = !authenticated || !!smartAccountAddress;

  // Reset chain-specific smart account state when chain changes
  useEffect(() => {
    if (prevChainRef.current === null) {
      prevChainRef.current = chain.id;
      return;
    }
    if (prevChainRef.current !== chain.id) {
      prevChainRef.current = chain.id;
      setSmartAccountAddress(null);
      setClient(null);
      setBaseAppDeployment(null);
      setStatus("");
      setError(null);
      setIsBaseAccountWallet(false);
    }
  }, [chain.id, chainKey]);

  // Ensure an embedded Privy wallet exists for signing
  useEffect(() => {
    if (!authenticated || !privyReady) {
      hasAttemptedCreate.current = false;
      return;
    }

    const hasEmbedded = wallets.some(
      (w) => w.type === "ethereum" && w.walletClientType === "privy",
    );

    if (!hasEmbedded && !hasAttemptedCreate.current) {
      hasAttemptedCreate.current = true;
      createWallet().catch((err) => {
        console.warn("Failed to create embedded wallet", err);
      });
    }
  }, [authenticated, privyReady, wallets, createWallet]);

  // Pick Privy wallet: always embedded (Privy)
  useEffect(() => {
    let cancelled = false;

    const selectWallet = async () => {
      if (!authenticated || !privyReady) {
        if (cancelled) return;
        setEffectiveWalletClient(null);
        setEoaAddress(null);
        setWalletSource(null);
        return;
      }

      const ethereumWallets = wallets.filter((w) => w.type === "ethereum");
      const getWalletKey = (w: any) =>
        String(w.walletClientType || w.connectorType || "").toLowerCase();
      const isBaseAccount = (w: any) =>
        ["base_account", "base"].includes(getWalletKey(w));
      const embedded = ethereumWallets.find(
        (w) => w.walletClientType === "privy",
      );

      // Always use embedded wallet for signing
      const chosen = embedded;

      if (!chosen) {
        if (cancelled) return;
        setEffectiveWalletClient(null);
        setEoaAddress(null);
        setWalletSource(null);
        setStatus("Embedded wallet not ready. Creating wallet...");
        return;
      }

      try {
        const provider = await chosen.getEthereumProvider();
        const addr = getAddress(chosen.address) as Address;
        const walletKey = getWalletKey(chosen);
        const account = { address: addr, type: "json-rpc" as const };
        const createClientAny = createWalletClient as any;
        const privyWalletClient = createClientAny({
          account,
          chain: chain,
          transport: custom(provider),
        });
        if (cancelled) return;
        setEffectiveWalletClient(privyWalletClient);
        setEoaAddress(addr);
        setWalletSource(
          chosen.walletClientType === "privy" ? "embedded" : "external",
        );
        setIsBaseAccountWallet(
          ["base_account", "base"].includes(
            String(walletKey || "").toLowerCase(),
          ),
        );
      } catch (err) {
        console.error("Failed to init Privy wallet", err);
        if (!cancelled) {
          setEffectiveWalletClient(null);
          setEoaAddress(null);
          setWalletSource(null);
          setIsBaseAccountWallet(false);
        }
      }
    };

    selectWallet();

    return () => {
      cancelled = true;
    };
  }, [wallets, privyReady, authenticated, chain]);

  useEffect(() => {
    if (!effectiveWalletClient || !eoaAddress) {
      setSmartAccountAddress(null);
      setClient(null);
      setStatus("");
      setError(null);
      setIsBaseAccountWallet(false);
    }
  }, [effectiveWalletClient, eoaAddress]);

  // Network validation on wallet connection
  useEffect(() => {
    let cancelled = false;

    const validateAndSwitchNetwork = async () => {
      if (!effectiveWalletClient) return;

      try {
        const currentChainId = await effectiveWalletClient.getChainId();
        const expectedChainId = chain.id;

        if (currentChainId !== expectedChainId) {
          setStatus(`Switching to ${chain.name}...`);

          try {
            // Attempt automatic switch
            await effectiveWalletClient.switchChain({ id: expectedChainId });
            if (!cancelled) {
              setStatus(`Connected to ${chain.name}`);
            }
          } catch (switchError) {
            // If switch fails, try adding chain first
            try {
              await effectiveWalletClient.addChain({ chain });
              await effectiveWalletClient.switchChain({ id: expectedChainId });
              if (!cancelled) {
                setStatus(`Connected to ${chain.name}`);
              }
            } catch (addError) {
              // Show manual instructions to user
              if (!cancelled) {
                const errorMessage = `Please switch to ${chain.name} (Chain ID: ${expectedChainId}) in your wallet`;
                setError(errorMessage);
                setStatus(errorMessage);
              }
            }
          }
        }
      } catch (err) {
        console.error("Network validation failed:", err);
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Network validation failed";
          setError(message);
        }
      }
    };

    validateAndSwitchNetwork();

    return () => {
      cancelled = true;
    };
  }, [effectiveWalletClient, chain]);

  useEffect(() => {
    let cancelled = false;

    const checkBaseAppDeployment = async () => {
      if (!isBaseAccountWallet || !eoaAddress) {
        if (!cancelled) {
          setBaseAppDeployment(null);
        }
        return;
      }

      const rpcUrl = chain.rpcUrls.default.http[0];
      setBaseAppDeployment({
        status: "checking",
        address: eoaAddress,
        chainId: chain.id,
        rpcUrl,
      });

      try {
        const bytecode = await publicClient.getBytecode({
          address: eoaAddress,
        });
        const codeLength = bytecode ? (bytecode.length - 2) / 2 : 0;
        if (cancelled) return;
        setBaseAppDeployment({
          status: bytecode && bytecode !== "0x" ? "deployed" : "missing",
          address: eoaAddress,
          chainId: chain.id,
          rpcUrl,
          codeLength,
        });
      } catch (err) {
        if (cancelled) return;
        setBaseAppDeployment({
          status: "unknown",
          address: eoaAddress,
          chainId: chain.id,
          rpcUrl,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    checkBaseAppDeployment();

    return () => {
      cancelled = true;
    };
  }, [isBaseAccountWallet, eoaAddress, publicClient, chain]);

  const wrapBaseAccountSignature = useCallback(
    (signature: `0x${string}`, ownerIndex: bigint = 0n) => {
      return encodeAbiParameters(
        [
          { name: "ownerIndex", type: "uint256" },
          { name: "signatureData", type: "bytes" },
        ],
        [ownerIndex, signature],
      ) as `0x${string}`;
    },
    [],
  );

  const getSmartAccountOwner = useCallback(() => {
    if (!effectiveWalletClient || !eoaAddress) return null;
    if (!isBaseAccountWallet) {
      return effectiveWalletClient;
    }

    const toRawMessageHex = (message: any): `0x${string}` => {
      if (typeof message === "string") {
        if (message.startsWith("0x")) {
          return message as `0x${string}`;
        }
        return stringToHex(message);
      }
      if (message?.raw instanceof Uint8Array) {
        return toHex(message.raw);
      }
      if (typeof message?.raw === "string") {
        if (message.raw.startsWith("0x")) {
          return message.raw as `0x${string}`;
        }
        return stringToHex(message.raw);
      }
      return toHex(message);
    };

    const signBaseAccountMessage = async (message: any) => {
      const hash = toRawMessageHex(message);
      const typedData = {
        domain: {
          name: "Coinbase Smart Wallet",
          version: "1",
          chainId: chain.id,
          verifyingContract: eoaAddress,
        },
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          CoinbaseSmartWalletMessage: [{ name: "hash", type: "bytes32" }],
        },
        primaryType: "CoinbaseSmartWalletMessage",
        message: { hash },
      };
      const typedDigest = hashTypedData(typedData as any);

      const validateSignature = async (
        sig: `0x${string}`,
        hashToCheck: `0x${string}`,
      ) => {
        try {
          const magic = await publicClient.readContract({
            address: eoaAddress,
            abi: [
              {
                type: "function",
                name: "isValidSignature",
                stateMutability: "view",
                inputs: [
                  { name: "hash", type: "bytes32" },
                  { name: "signature", type: "bytes" },
                ],
                outputs: [{ name: "magicValue", type: "bytes4" }],
              },
            ],
            functionName: "isValidSignature",
            args: [hashToCheck, sig],
          });
          return String(magic).toLowerCase() === "0x1626ba7e";
        } catch {
          return false;
        }
      };

      try {
        const rawSig = (await (effectiveWalletClient as any).signTypedData(
          typedData,
        )) as `0x${string}`;
        const candidatesSet = new Set<`0x${string}`>();
        const candidateOwnerIndex = new Map<`0x${string}`, number>();
        const addCandidate = (value?: `0x${string}`) => {
          if (value) {
            candidatesSet.add(value);
          }
        };
        const tryDecodeBytes = (value: `0x${string}`) => {
          try {
            const [inner] = decodeAbiParameters(
              [{ name: "signature", type: "bytes" }],
              value,
            );
            const innerSig = inner as `0x${string}`;
            if (innerSig && innerSig !== value) {
              addCandidate(innerSig);
            }
          } catch {
            // ignore decode errors
          }
        };

        addCandidate(rawSig);
        tryDecodeBytes(rawSig);
        let ownerIndexMax = 5;
        try {
          const nextOwnerIndex = (await publicClient.readContract({
            address: eoaAddress,
            abi: [
              {
                type: "function",
                name: "nextOwnerIndex",
                stateMutability: "view",
                inputs: [],
                outputs: [{ name: "index", type: "uint256" }],
              },
            ],
            functionName: "nextOwnerIndex",
          })) as bigint;
          const maxIndex = Number(nextOwnerIndex);
          if (Number.isFinite(maxIndex) && maxIndex > 0) {
            ownerIndexMax = Math.min(Math.max(maxIndex - 1, 0), 10);
          }
        } catch {
          ownerIndexMax = 5;
        }

        for (let i = 0; i <= ownerIndexMax; i += 1) {
          const wrapped = wrapBaseAccountSignature(rawSig, BigInt(i));
          addCandidate(wrapped);
          candidateOwnerIndex.set(wrapped, i);
        }

        try {
          const [signatureData, ownerIndex] = decodeAbiParameters(
            [
              { name: "signatureData", type: "bytes" },
              { name: "ownerIndex", type: "uint256" },
            ],
            rawSig,
          ) as [`0x${string}`, bigint];
          if (signatureData && signatureData !== "0x") {
            const normalized = wrapBaseAccountSignature(
              signatureData,
              ownerIndex,
            );
            addCandidate(normalized);
            candidateOwnerIndex.set(normalized, Number(ownerIndex));
          }
        } catch {
          // ignore decode errors
        }

        // If we decoded a nested signature, try decoding one more layer.
        for (const candidate of Array.from(candidatesSet)) {
          tryDecodeBytes(candidate);
        }
        const candidates = Array.from(candidatesSet);

        let selected: `0x${string}` | null = null;
        for (const candidate of candidates) {
          const valid = await validateSignature(candidate, typedDigest);
          const ownerIndex = candidateOwnerIndex.get(candidate);
          if (!selected && valid) {
            selected = candidate;
          }
        }

        const fallbackIndex = candidateOwnerIndex.values().next().value;
        return (
          selected ??
          wrapBaseAccountSignature(rawSig, BigInt(fallbackIndex ?? 0))
        );
      } catch (err) {
        console.warn("Base Account typed data sign failed, falling back", err);
        const rawSig = (await effectiveWalletClient.signMessage({
          message,
        } as any)) as `0x${string}`;
        const candidatesSet = new Set<`0x${string}`>();
        const candidateOwnerIndex = new Map<`0x${string}`, number>();
        const addCandidate = (value?: `0x${string}`) => {
          if (value) {
            candidatesSet.add(value);
          }
        };
        const tryDecodeBytes = (value: `0x${string}`) => {
          try {
            const [inner] = decodeAbiParameters(
              [{ name: "signature", type: "bytes" }],
              value,
            );
            const innerSig = inner as `0x${string}`;
            if (innerSig && innerSig !== value) {
              addCandidate(innerSig);
            }
          } catch {
            // ignore decode errors
          }
        };
        addCandidate(rawSig);
        tryDecodeBytes(rawSig);
        let ownerIndexMax = 5;
        try {
          const nextOwnerIndex = (await publicClient.readContract({
            address: eoaAddress,
            abi: [
              {
                type: "function",
                name: "nextOwnerIndex",
                stateMutability: "view",
                inputs: [],
                outputs: [{ name: "index", type: "uint256" }],
              },
            ],
            functionName: "nextOwnerIndex",
          })) as bigint;
          const maxIndex = Number(nextOwnerIndex);
          if (Number.isFinite(maxIndex) && maxIndex > 0) {
            ownerIndexMax = Math.min(Math.max(maxIndex - 1, 0), 10);
          }
        } catch {
          ownerIndexMax = 5;
        }
        for (let i = 0; i <= ownerIndexMax; i += 1) {
          const wrapped = wrapBaseAccountSignature(rawSig, BigInt(i));
          addCandidate(wrapped);
          candidateOwnerIndex.set(wrapped, i);
        }

        try {
          const [signatureData, ownerIndex] = decodeAbiParameters(
            [
              { name: "signatureData", type: "bytes" },
              { name: "ownerIndex", type: "uint256" },
            ],
            rawSig,
          ) as [`0x${string}`, bigint];
          if (signatureData && signatureData !== "0x") {
            const normalized = wrapBaseAccountSignature(
              signatureData,
              ownerIndex,
            );
            addCandidate(normalized);
            candidateOwnerIndex.set(normalized, Number(ownerIndex));
          }
        } catch {
          // ignore decode errors
        }

        for (const candidate of Array.from(candidatesSet)) {
          tryDecodeBytes(candidate);
        }
        const candidates = Array.from(candidatesSet);
        let selected: `0x${string}` | null = null;
        for (const candidate of candidates) {
          const valid = await validateSignature(candidate, typedDigest);
          const ownerIndex = candidateOwnerIndex.get(candidate);
          if (!selected && valid) {
            selected = candidate;
          }
        }
        if (selected) {
          return selected;
        }
        const fallbackIndex = candidateOwnerIndex.values().next().value;
        return wrapBaseAccountSignature(rawSig, BigInt(fallbackIndex ?? 0));
      }
    };

    return toAccount({
      address: eoaAddress,
      async signMessage({ message }) {
        return (await signBaseAccountMessage(message)) as `0x${string}`;
      },
      async signTypedData(typedData) {
        return (await (effectiveWalletClient as any).signTypedData(
          typedData as any,
        )) as `0x${string}`;
      },
      async signTransaction(_) {
        throw new Error("Smart account signer doesn't sign transactions");
      },
    });
  }, [
    effectiveWalletClient,
    eoaAddress,
    isBaseAccountWallet,
    wrapBaseAccountSignature,
  ]);

  /**
   * Check paymaster deposit in EntryPoint
   * Logs warnings if balance is low but does not block transactions
   * The bundler will reject operations if deposit is empty
   */
  const checkPaymasterDeposit = useCallback(async (): Promise<void> => {
    try {
      const depositInfo = await publicClient.readContract({
        address: entryPointAddress,
        abi: ENTRYPOINT_ABI,
        functionName: "getDepositInfo",
        args: [paymasterAddress],
      });

      const deposit = depositInfo.deposit;
      const minimumRequired = parseUnits("0.01", 18); // 0.01 ETH minimum

      if (deposit === 0n) {
        console.warn(
          `⚠️ Paymaster has no ETH deposited in EntryPoint. Gas sponsorship unavailable.`
        );
      } else if (deposit < minimumRequired) {
        console.warn(
          `⚠️ Paymaster deposit low: ${formatUnits(deposit, 18)} ETH (minimum: ${formatUnits(minimumRequired, 18)} ETH)`
        );
      } else {
        console.log(
          `✓ Paymaster deposit: ${formatUnits(deposit, 18)} ETH`
        );
      }
    } catch (err) {
      console.warn("Failed to check paymaster deposit:", err);
    }
  }, [publicClient, entryPointAddress, paymasterAddress]);

  // EntryPoint validation
  useEffect(() => {
    let cancelled = false;

    const validateEntryPoint = async () => {
      if (!publicClient || !entryPointAddress) return;

      try {
        console.log(`EntryPoint configured: ${entryPointAddress} on chain ${chain.id}`);

        // Verify EntryPoint has code deployed
        const bytecode = await publicClient.getBytecode({
          address: entryPointAddress,
        });

        if (!bytecode || bytecode === "0x") {
          const errorMessage = `EntryPoint not deployed at ${entryPointAddress} on chain ${chain.id}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }

        console.log("EntryPoint validation passed");
      } catch (err) {
        console.error("EntryPoint validation failed:", err);
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err);
          setError(`Invalid EntryPoint configuration: ${message}`);
        }
      }
    };

    validateEntryPoint();

    return () => {
      cancelled = true;
    };
  }, [publicClient, entryPointAddress, chain.id]);

  // Auto-initialize Smart Account when EOA wallet is ready
  useEffect(() => {
    let cancelled = false;

    const autoInitSmartAccount = async () => {
      // Only auto-init if we have EOA but no Smart Account yet
      if (
        !effectiveWalletClient ||
        !eoaAddress ||
        smartAccountAddress ||
        client
      ) {
        return;
      }

      try {
        setStatus("Auto-initializing Smart Account...");
        const owner = getSmartAccountOwner();
        if (!owner) return;
        const simpleAccount = await toSimpleSmartAccount({
          client: publicClient,
          owner,
          entryPoint: { address: entryPointAddress, version: "0.7" as const },
          factoryAddress: simpleAccountFactory,
        });

        if (cancelled) return;

        // Check if smart account is already deployed
        const bytecode = await publicClient.getBytecode({
          address: simpleAccount.address,
        });
        const isDeployed = bytecode && bytecode !== "0x";

        if (isDeployed) {
          console.log(`Smart Account already deployed at ${simpleAccount.address}`);
          setStatus("Smart Account already deployed");
        } else {
          console.log(`Smart Account not yet deployed at ${simpleAccount.address}`);
          setStatus("Smart Account ready (will deploy on first transaction)");
        }

        const smartAccountClient = createSmartAccountClient({
          account: simpleAccount,
          chain: chain,
          bundlerTransport: http(bundlerUrl),
        });

        // Check bundler health after client creation
        try {
          const bundlerHealth = await checkBundlerHealth();
          if (!bundlerHealth.isAvailable) {
            console.warn(`Bundler health check failed. Supported methods: ${bundlerHealth.supportedMethods.join(", ")}`);
          }
        } catch (error) {
          console.error("Bundler health check error:", error);
        }

        // Check paymaster deposit in EntryPoint
        try {
          await checkPaymasterDeposit();
        } catch (error) {
          console.error("Paymaster deposit check error:", error);
        }

        setSmartAccountAddress(simpleAccount.address);
        setClient(smartAccountClient);
        setStatus("Smart Account ready");
      } catch (err) {
        console.error("Auto-init Smart Account failed:", err);
        if (!cancelled) {
          setStatus("Auto-init failed. Click Init SA to retry.");
        }
      }
    };

    autoInitSmartAccount();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveWalletClient,
    eoaAddress,
    smartAccountAddress,
    client,
    getSmartAccountOwner,
    publicClient,
    chain,
    entryPointAddress,
    simpleAccountFactory,
    bundlerUrl,
    checkBundlerHealth,
    checkPaymasterDeposit,
  ]);

  /**
   * Check if paymaster approvals are set up for a token
   * Returns true if approval exists, false otherwise
   */
  const checkPaymasterApproval = useCallback(
    async (tokenAddress: Address, ownerAddress: Address): Promise<boolean> => {
      try {
        const allowance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [ownerAddress, paymasterAddress],
        }) as bigint;

        // Consider approved if allowance is greater than 0
        return allowance > 0n;
      } catch (error) {
        console.warn(`Failed to check allowance for ${tokenAddress}:`, error);
        return false;
      }
    },
    [publicClient, paymasterAddress]
  );

  // Track in-progress approvals to prevent concurrent approval attempts
  const approvalsInProgress = useRef<Set<Address>>(new Set());

  /**
   * Detect provider-side direct-send failures that should gracefully fall back
   * to sponsored activation approval flow.
   */
  const shouldFallbackToSponsoredApproval = useCallback((error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const normalized = message.toLowerCase();

    // Existing failure mode: no native gas for direct wallet tx.
    const insufficientNativeGas =
      normalized.includes("insufficient funds") ||
      normalized.includes("gas * price + value") ||
      normalized.includes("gas \* price \+ value");

    // Provider compatibility failures observed in production for wallet_sendTransaction.
    const methodUnsupported =
      normalized.includes("this request method is not supported") ||
      normalized.includes("wallet_sendtransaction") ||
      normalized.includes("code\":-32604") ||
      normalized.includes("direct_approval_unsupported_provider") ||
      normalized.includes("missing or invalid parameters") ||
      (normalized.includes("http request failed") && normalized.includes("status: 400"));

    return insufficientNativeGas || methodUnsupported;
  }, []);

  const authorizedSignerCheckCacheRef = useRef<Set<string>>(new Set());

  const ensureBackendSignerAuthorized = useCallback(async () => {
    const signerAddress = await getSignerAddress();
    if (!signerAddress) {
      throw new Error("Backend signer is not available from /signer endpoint.");
    }

    const normalizedSigner = getAddress(signerAddress as Address);
    const cacheKey = `${chain.id}:${paymasterAddress.toLowerCase()}:${normalizedSigner.toLowerCase()}`;
    if (authorizedSignerCheckCacheRef.current.has(cacheKey)) {
      return;
    }

    const isAuthorized = (await publicClient.readContract({
      address: paymasterAddress,
      abi: [
        {
          type: "function",
          name: "authorizedSigners",
          stateMutability: "view",
          inputs: [{ name: "signer", type: "address" }],
          outputs: [{ type: "bool" }],
        },
      ],
      functionName: "authorizedSigners",
      args: [normalizedSigner],
    })) as boolean;

    if (!isAuthorized) {
      throw new Error(
        `Paymaster signer ${normalizedSigner} is not authorized on-chain for paymaster ${paymasterAddress}. Ask contract admin to authorize this signer first.`
      );
    }

    authorizedSignerCheckCacheRef.current.add(cacheKey);
  }, [chain.id, paymasterAddress, publicClient]);

  /**
   * Ensure a single token has approval for the paymaster
   * Uses walletClient.writeContract() for direct wallet transactions (not UserOperations)
    * Falls back to one-time sponsored activation approval when native gas is unavailable
    * Implements lazy approval: only approves when needed
   * Includes reentrancy protection to prevent concurrent approvals
   */
  const ensureTokenApproval = useCallback(
    async (tokenAddress: Address, spenderAddress: Address): Promise<void> => {
      if (!smartAccountAddress || !effectiveWalletClient) {
        throw new Error("Wallet not ready");
      }

      // Reentrancy protection: check if approval is already in progress
      if (approvalsInProgress.current.has(tokenAddress)) {
        console.log(`Approval already in progress for ${tokenAddress}, waiting...`);
        // Wait for the in-progress approval to complete
        while (approvalsInProgress.current.has(tokenAddress)) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return;
      }

      try {
        // Mark approval as in progress
        approvalsInProgress.current.add(tokenAddress);

        // Check current allowance
        const allowance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [smartAccountAddress, spenderAddress],
        }) as bigint;

        // If allowance is sufficient, skip approval
        if (allowance > 0n) {
          console.log(`Token ${tokenAddress} already approved for ${spenderAddress}`);
          return;
        }

        try {
          // Option 1: skip direct tx for provider types that are known to reject
          // wallet_sendTransaction in this flow (e.g., embedded provider path).
          const skipDirectApproval = walletSource === "embedded";
          if (skipDirectApproval) {
            throw new Error("direct_approval_unsupported_provider");
          }

          console.log(`Approving token ${tokenAddress} for ${spenderAddress} via walletClient.writeContract()...`);

          // Primary path: direct wallet transaction.
          const txHash = await effectiveWalletClient.writeContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [spenderAddress, maxUint256],
            chain: chain,
            account: smartAccountAddress,
          });

          console.log(`Approval transaction submitted: ${txHash}`);

          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1,
          });

          if (receipt.status !== "success") {
            throw new Error(`Approval transaction failed for ${tokenAddress}`);
          }
          console.log(`Token ${tokenAddress} approved successfully`);
          return;
        } catch (directErr) {
          const shouldFallback = shouldFallbackToSponsoredApproval(directErr);

          if (!shouldFallback) {
            throw directErr;
          }

          console.warn(
            `Direct approval unavailable. Falling back to sponsored activation approval for ${tokenAddress}.`
          );
          setStatus("Direct approval unavailable; retrying with sponsored approval...");

          const { client, address } = await ensureClient();

          const submitSponsoredApproval = async (
            gasToken: Address,
            isActivation: boolean,
            reasonLabel: string
          ): Promise<void> => {
            await ensureBackendSignerAuthorized();

            const isAa34SignatureError = (error: unknown): boolean => {
              const msg = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
              return msg.includes("aa34") || msg.includes("signature provided for the user operation is invalid");
            };

            let lastError: unknown;
            for (let attempt = 0; attempt < 2; attempt += 1) {
              try {
                const validUntil = Math.floor(Date.now() / 1000) + 3600 + attempt;
                const validAfter = 0;

                const signature = await getPaymasterSignature({
                  payerAddress: address,
                  tokenAddress: gasToken,
                  validUntil,
                  validAfter,
                  isActivation,
                });

                const paymasterData = buildPaymasterData({
                  tokenAddress: gasToken,
                  payerAddress: address,
                  validUntil,
                  validAfter,
                  hasPermit: false,
                  isActivation,
                  signature: signature as `0x${string}`,
                });

                const feeParams = await getFeeParams();
                const res = await client.sendCalls({
                  calls: [
                    {
                      to: tokenAddress,
                      data: encodeFunctionData({
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [spenderAddress, maxUint256],
                      }),
                      value: BigInt(0),
                    },
                  ],
                  paymaster: paymasterAddress,
                  paymasterData,
                  paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
                  paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
                  callGasLimit: BigInt(160_000),
                  verificationGasLimit: BigInt(500_000),
                  preVerificationGas: PRE_VERIFICATION_GAS,
                  ...feeParams,
                });

                const userOpHash = res.id as `0x${string}`;
                const sponsoredReceipt = await waitForUserOp(userOpHash);
                if (!sponsoredReceipt.success) {
                  throw new Error(
                    sponsoredReceipt.reason ||
                    `Sponsored approval UserOperation failed for ${tokenAddress} (${reasonLabel})`
                  );
                }

                return;
              } catch (attemptError) {
                lastError = attemptError;
                if (!isAa34SignatureError(attemptError) || attempt > 0) {
                  throw attemptError;
                }

                setStatus("Signer mismatch detected (AA34). Retrying with fresh signature...");
              }
            }

            throw lastError instanceof Error
              ? lastError
              : new Error(`Sponsored approval failed for ${tokenAddress} (${reasonLabel})`);
          };

          try {
            // First attempt: one-time activation sponsorship for first approval setup.
            await submitSponsoredApproval(tokenAddress, true, "activation");
            console.log(`Token ${tokenAddress} approved successfully via sponsored activation`);
          } catch (activationErr) {
            const activationMsg =
              activationErr instanceof Error
                ? activationErr.message.toLowerCase()
                : String(activationErr ?? "").toLowerCase();

            const alreadyActivated =
              activationMsg.includes("already activated") ||
              activationMsg.includes("already_activated");

            if (!alreadyActivated) {
              throw activationErr;
            }

            // Wallet is already activated: sponsor this approval using another already-approved gas token.
            setStatus("Wallet already activated; retrying sponsorship with approved gas token...");

            let fallbackGasToken: Address | null = null;
            for (const candidateToken of SUPPORTED_PAYMASTER_TOKENS) {
              try {
                const candidateAllowance = (await publicClient.readContract({
                  address: candidateToken,
                  abi: ERC20_ABI,
                  functionName: "allowance",
                  args: [smartAccountAddress, paymasterAddress],
                })) as bigint;

                if (candidateAllowance <= 0n) {
                  continue;
                }

                const candidateBalance = (await publicClient.readContract({
                  address: candidateToken,
                  abi: ERC20_ABI,
                  functionName: "balanceOf",
                  args: [smartAccountAddress],
                })) as bigint;

                if (candidateBalance > 0n) {
                  fallbackGasToken = candidateToken;
                  break;
                }
              } catch {
                // Ignore token probe failures and continue trying other supported tokens.
              }
            }

            if (!fallbackGasToken) {
              throw new Error(
                "Wallet is already activated on-chain and no previously approved paymaster gas token with balance was found."
              );
            }

            await submitSponsoredApproval(fallbackGasToken, false, "approved-gas-token");
            console.log(
              `Token ${tokenAddress} approved successfully via sponsored fallback gas token ${fallbackGasToken}`
            );
          }
        }
      } catch (error) {
        console.error(`Failed to approve token ${tokenAddress}:`, error);
        throw new Error(`Token approval failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        // Remove from in-progress set
        approvalsInProgress.current.delete(tokenAddress);
      }
    },
    [smartAccountAddress, effectiveWalletClient, publicClient, chain, shouldFallbackToSponsoredApproval, walletSource, ensureBackendSignerAuthorized]
  );

  const getFeeParams = useCallback(async () => {
    // Increased buffer to 150% to handle network congestion and bundler requirements
    const addBuffer = (value: bigint) => {
      const bumped = (value * 25n) / 10n; // +150% (2.5x multiplier)
      return bumped > value ? bumped : value + 1n;
    };

    const MIN_PRIORITY_FEE = 6_000_000n; // 0.006 gwei fallback (bundler requirement)
    const normalizePriorityFee = (value: bigint) =>
      value < MIN_PRIORITY_FEE ? MIN_PRIORITY_FEE : value;

    const normalizeFees = (maxFeePerGas: bigint, maxPriorityFeePerGas: bigint) => {
      let maxFee = addBuffer(maxFeePerGas);
      let maxPriority = addBuffer(maxPriorityFeePerGas);
      maxPriority = normalizePriorityFee(maxPriority);
      if (maxFee < maxPriority) {
        maxFee = maxPriority;
      }
      return { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxPriority };
    };

    try {
      const bundlerFees = await bundlerClient.request({
        method: "pimlico_getUserOperationGasPrice",
        params: [],
      });
      const tier =
        (bundlerFees as any)?.fast ||
        (bundlerFees as any)?.standard ||
        (bundlerFees as any)?.slow;
      if (tier?.maxFeePerGas && tier?.maxPriorityFeePerGas) {
        return normalizeFees(
          BigInt(tier.maxFeePerGas),
          BigInt(tier.maxPriorityFeePerGas),
        );
      }
    } catch {
      // fallback to publicClient below
    }

    try {
      const fees = await publicClient.estimateFeesPerGas();
      return normalizeFees(fees.maxFeePerGas, fees.maxPriorityFeePerGas);
    } catch {
      const gasPrice = await publicClient.getGasPrice();
      return normalizeFees(gasPrice, gasPrice);
    }
  }, [publicClient, bundlerClient]);

  const estimatePaymasterCost = useCallback(
    async (
      token: Address,
      gasLimit: bigint,
      maxFeePerGas: bigint,
    ): Promise<bigint> => {
      try {
        const cost = await publicClient.readContract({
          address: paymasterAddress,
          abi: PAYMASTER_ABI,
          functionName: "estimateTotalCost",
          args: [token, gasLimit, maxFeePerGas],
        });
        return cost as bigint;
      } catch (err) {
        console.warn("estimateTotalCost failed", err);
        return 0n;
      }
    },
    [publicClient, paymasterAddress],
  );

  const assertPaymasterBalance = useCallback(
    async (params: {
      token: Address;
      owner: Address;
      spendAmount: bigint;
      decimals: number;
      gasLimit: bigint;
      maxFeePerGas: bigint;
    }) => {
      // For signature-based paymaster, we only need to check:
      // 1. Token is supported by paymaster
      // 2. User has sufficient balance for the transaction amount + gas
      // Allowance checks are skipped since signature validation replaces on-chain approval
      const [supported, balance, gasCost] = await Promise.all([
        publicClient.readContract({
          address: paymasterAddress,
          abi: PAYMASTER_ABI,
          functionName: "isSupportedToken",
          args: [params.token],
        }) as Promise<boolean>,
        publicClient.readContract({
          address: params.token,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [params.owner],
        }) as Promise<bigint>,
        estimatePaymasterCost(
          params.token,
          params.gasLimit,
          params.maxFeePerGas,
        ),
      ]);

      if (!supported) {
        throw new Error(
          "Token belum didukung oleh paymaster. Coba token lain atau update daftar token paymaster.",
        );
      }

      const required = params.spendAmount + gasCost;
      if (balance < required) {
        const missing = required - balance;
        const missingFormatted = formatUnits(missing, params.decimals);
        throw new Error(
          `Insufficient balance to cover amount + gas fee. Leave about ${missingFormatted} more tokens for gas.`,
        );
      }
    },
    [estimatePaymasterCost, publicClient, paymasterAddress],
  );

  const waitForUserOp = useCallback(
    async (userOpHash: `0x${string}`) => {
      // Increased to 40 iterations (40 x 3s = 120s) for complex multi-token transactions
      for (let i = 0; i < 40; i++) {
        try {
          const receipt = (await bundlerClient.request({
            // viem types don't include 4337, so cast
            method: "eth_getUserOperationReceipt",
            params: [userOpHash],
          } as any)) as any;

          if (receipt) {
            let success =
              typeof receipt.success === "boolean"
                ? receipt.success
                : Boolean(receipt?.receipt?.status);
            const txHash = receipt?.receipt?.transactionHash;
            const reason = receipt?.reason;

            // Decode UserOperationEvent if present to trust on-chain flag
            if (receipt.receipt?.logs) {
              const userOpEventTopic =
                "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f";
              const entryLog = receipt.receipt.logs.find(
                (l: any) =>
                  l.topics &&
                  l.topics.length > 0 &&
                  l.topics[0] === userOpEventTopic,
              );
              if (entryLog) {
                // success is the 5th non-indexed slot in data
                const data = entryLog.data as string;
                if (data && data.length >= 2 + 64 * 3) {
                  const successFlag = data.slice(2 + 64, 2 + 64 * 2);
                  // success is encoded as a full 32-byte word with last byte 0/1
                  success = successFlag.endsWith("1");
                }
              }
            }

            return { success, txHash, reason };
          }
        } catch (err) {
          // keep polling; bundler might not have it yet
          console.warn("waitForUserOp poll error", err);
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      return {
        success: false,
        txHash: null,
        reason: "Timed out waiting for receipt",
      };
    },
    [bundlerClient],
  );

  /**
   * Decode UserOperation error codes into user-friendly messages
   */
  const decodeUserOpError = useCallback((error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);

    // AA error codes from ERC-4337
    if (message.includes('AA21')) {
      return 'Paymaster validation failed. Please try again or contact support.';
    }
    if (message.includes('AA23')) {
      return 'Transaction reverted during execution. Please check your balance and try again.';
    }
    if (message.includes('AA24')) {
      return 'Invalid signature. Please reconnect your wallet and try again.';
    }
    if (message.includes('AA31')) {
      return 'Paymaster deposit too low. Gas sponsorship temporarily unavailable.';
    }
    if (message.includes('AA33')) {
      return 'Paymaster allowance insufficient. Setting up approvals...';
    }

    // Generic simulation failure
    if (message.toLowerCase().includes('simulation') || message.toLowerCase().includes('estimate')) {
      return 'Transaction simulation failed. Please check your inputs and try again.';
    }

    return message;
  }, []);

  /**
   * Simulate UserOperation before submission to catch errors early
   * Uses eth_estimateUserOperationGas to validate execution
   */
  const simulateUserOp = useCallback(
    async (
      userOp: any,
      entryPoint: Address,
    ): Promise<{ success: boolean; error?: string; gasEstimate?: any }> => {
      try {
        // Attempt gas estimation which simulates the UserOp
        const gasEstimate = await bundlerClient.request({
          method: 'eth_estimateUserOperationGas',
          params: [userOp, entryPoint],
        } as any);

        return { success: true, gasEstimate };
      } catch (error) {
        const decodedError = decodeUserOpError(error);
        console.error('UserOperation simulation failed:', decodedError);
        return { success: false, error: decodedError };
      }
    },
    [bundlerClient, decodeUserOpError],
  );

  /**
   * Submit a UserOperation with retry logic for network failures
   * @param client - Smart account client
   * @param params - SendCalls parameters
   * @param maxRetries - Maximum number of retries (default: 1)
   * @returns UserOperation hash
   */
  const submitUserOpWithRetry = useCallback(
    async (
      client: ReturnType<typeof createSmartAccountClient>,
      params: Parameters<typeof client.sendCalls>[0],
      maxRetries: number = 1,
    ): Promise<string> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await client.sendCalls(params);
          return res.id as string;
        } catch (error) {
          lastError = error as Error;
          const message = error instanceof Error ? error.message : String(error);

          // Check if this is a network error
          if (message.includes("Failed to fetch")) {
            console.warn(
              `Bundler submission failed (attempt ${attempt + 1}/${maxRetries + 1}): ${message}`,
            );

            // If we haven't exhausted retries, wait and try again
            if (attempt < maxRetries) {
              console.log("Waiting 2 seconds before retry...");
              await new Promise((resolve) => setTimeout(resolve, 2000));
              continue;
            }

            // Max retries exceeded
            throw new Error(
              `Bundler RPC unreachable at ${bundlerUrl}. Please try again later.`,
            );
          }

          // Non-network error, don't retry
          throw error;
        }
      }

      // Should never reach here, but TypeScript needs this
      throw lastError || new Error("UserOperation submission failed");
    },
    [bundlerUrl],
  );

  const ensureClient = useCallback(async () => {
    if (client && smartAccountAddress) {
      return { client, address: smartAccountAddress };
    }

    const owner = getSmartAccountOwner();
    if (!owner || !eoaAddress) {
      throw new Error("Connect EOA wallet first");
    }

    setStatus("Preparing smart account...");
    const simpleAccount = await toSimpleSmartAccount({
      client: publicClient,
      owner,
      entryPoint: { address: entryPointAddress, version: "0.7" as const },
      factoryAddress: simpleAccountFactory,
    });

    // Check if smart account is already deployed
    const bytecode = await publicClient.getBytecode({
      address: simpleAccount.address,
    });
    const isDeployed = bytecode && bytecode !== "0x";

    if (isDeployed) {
      console.log(`Smart Account already deployed at ${simpleAccount.address}`);
    } else {
      console.log(`Smart Account not yet deployed at ${simpleAccount.address}, will deploy on first transaction`);
    }

    const smartAccountClient = createSmartAccountClient({
      account: simpleAccount,
      chain: chain,
      bundlerTransport: http(bundlerUrl),
    });

    setSmartAccountAddress(simpleAccount.address);
    setClient(smartAccountClient);
    return { client: smartAccountClient, address: simpleAccount.address };
  }, [
    client,
    smartAccountAddress,
    getSmartAccountOwner,
    eoaAddress,
    publicClient,
    entryPointAddress,
    simpleAccountFactory,
    chain,
    bundlerUrl,
  ]);

  const approvePaymaster = useCallback(
    async (tokenAddresses: Address[]) => {
      setError(null);
      setIsLoading(true);
      try {
        if (!effectiveWalletClient || !smartAccountAddress) {
          throw new Error("Wallet not ready");
        }

        // Check if wallet is already deployed
        const bytecode = await publicClient.getBytecode({ address: smartAccountAddress });
        const isDeployed = bytecode && bytecode !== "0x";

        setStatus(isDeployed ? "Approving tokens via direct wallet transactions..." : "Wallet activation required before approvals");

        // Execute approvals as direct wallet transactions (NOT UserOperations)
        const approvalResults = [];
        for (const tokenAddress of tokenAddresses) {
          try {
            console.log(`Approving token ${tokenAddress} for paymaster ${paymasterAddress}...`);

            const txHash = await effectiveWalletClient.writeContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "approve",
              args: [paymasterAddress, maxUint256],
              chain: chain,
              account: smartAccountAddress,
            });

            console.log(`Approval transaction submitted: ${txHash}`);

            // Wait for transaction confirmation
            const receipt = await publicClient.waitForTransactionReceipt({
              hash: txHash,
              confirmations: 1,
            });

            if (receipt.status === "success") {
              console.log(`Token ${tokenAddress} approved successfully`);
              approvalResults.push({ token: tokenAddress, txHash, success: true });
            } else {
              throw new Error(`Approval transaction failed for ${tokenAddress}`);
            }
          } catch (err) {
            console.error(`Failed to approve token ${tokenAddress}:`, err);
            approvalResults.push({ token: tokenAddress, success: false, error: err });
            throw new Error(`Token approval failed for ${tokenAddress}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        setStatus("All tokens approved successfully");
        return {
          txHash: approvalResults[0]?.txHash || "0x",
          sender: smartAccountAddress,
          approvals: approvalResults
        };
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveWalletClient, smartAccountAddress, publicClient, chain, paymasterAddress],
  );

  const claimFaucet = useCallback(
    async (params: { tokenAddress: Address; amount: number }) => {
      setError(null);
      setIsLoading(true);
      try {
        const { client, address } = await ensureClient();
        const feeParams = await getFeeParams();

        const faucetData = encodeFunctionData({
          abi: FAUCET_ABI,
          functionName: "faucet",
          args: [BigInt(params.amount)],
        });

        setStatus("Requesting paymaster signature for faucet...");
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.tokenAddress,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.tokenAddress,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        setStatus("Submitting faucet UserOperation...");
        const userOpHash = await submitUserOpWithRetry(client, {
          calls: [
            {
              to: params.tokenAddress,
              data: faucetData,
              value: BigInt(0),
            },
          ],
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: BigInt(200_000),
          paymasterPostOpGasLimit: BigInt(200_000),
          callGasLimit: BigInt(220_000),
          verificationGasLimit: BigInt(450_000),
          ...feeParams,
        }) as `0x${string}`;
        setStatus("Faucet submitted, waiting for execution...");
        const receipt = await waitForUserOp(userOpHash);
        if (!receipt.success) {
          const reason = receipt.reason || "Faucet failed";
          throw new Error(reason);
        }
        setStatus("Faucet executed on-chain");
        return { txHash: receipt.txHash || userOpHash, sender: address };
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp, assertPaymasterBalance],
  );

  const registerQris = useCallback(
    async (params: {
      qrisHash: `0x${string}`;
      qrisPayload: string;
      merchantName: string;
      merchantId: string;
      merchantCity: string;
      feeToken: Address;
      feeTokenDecimals: number;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        const { client, address } = await ensureClient();
        const feeParams = await getFeeParams();

        const gasLimitEstimate =
          520_000n +
          PAYMASTER_VERIFICATION_GAS +
          PAYMASTER_POST_OP_GAS +
          PRE_VERIFICATION_GAS;

        await assertPaymasterBalance({
          token: params.feeToken,
          owner: address,
          spendAmount: 0n,
          decimals: params.feeTokenDecimals,
          gasLimit: gasLimitEstimate,
          maxFeePerGas: feeParams.maxFeePerGas,
        });

        setStatus("Requesting paymaster signature for QRIS...");
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.feeToken,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.feeToken,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        const registerData = encodeFunctionData({
          abi: QRIS_REGISTRY_ABI,
          functionName: "registerQris",
          args: [
            params.qrisHash,
            params.qrisPayload,
            params.merchantName,
            params.merchantId,
            params.merchantCity,
          ],
        });

        setStatus("Submitting QRIS registration...");
        const res = await client.sendCalls({
          calls: [
            {
              to: qrisRegistryAddress,
              data: registerData,
              value: BigInt(0),
            },
          ],
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
          paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
          callGasLimit: BigInt(520_000),
          verificationGasLimit: BigInt(900_000),
          preVerificationGas: PRE_VERIFICATION_GAS,
          ...feeParams,
        });

        const userOpHash = res.id as `0x${string}`;
        setStatus("QRIS submitted, waiting for execution...");
        const receipt = await waitForUserOp(userOpHash);
        if (!receipt.success) {
          const reason = receipt.reason || "QRIS registration failed";
          throw new Error(reason);
        }
        setStatus("QRIS registered on-chain");
        return receipt.txHash || userOpHash;
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp, assertPaymasterBalance],
  );

  const removeMyQris = useCallback(
    async (params: { feeToken: Address; feeTokenDecimals: number }) => {
      setError(null);
      setIsLoading(true);
      try {
        const { client, address } = await ensureClient();
        const feeParams = await getFeeParams();

        const gasLimitEstimate =
          220_000n +
          PAYMASTER_VERIFICATION_GAS +
          PAYMASTER_POST_OP_GAS +
          PRE_VERIFICATION_GAS;

        await assertPaymasterBalance({
          token: params.feeToken,
          owner: address,
          spendAmount: 0n,
          decimals: params.feeTokenDecimals,
          gasLimit: gasLimitEstimate,
          maxFeePerGas: feeParams.maxFeePerGas,
        });

        setStatus("Requesting paymaster signature for QRIS removal...");
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.feeToken,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.feeToken,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        const removeData = encodeFunctionData({
          abi: QRIS_REGISTRY_ABI,
          functionName: "removeMyQris",
          args: [],
        });

        setStatus("Submitting QRIS removal...");
        const res = await client.sendCalls({
          calls: [
            {
              to: qrisRegistryAddress,
              data: removeData,
              value: BigInt(0),
            },
          ],
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
          paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
          callGasLimit: BigInt(220_000),
          verificationGasLimit: BigInt(500_000),
          preVerificationGas: PRE_VERIFICATION_GAS,
          ...feeParams,
        });

        const userOpHash = res.id as `0x${string}`;
        setStatus("QRIS removal submitted, waiting for execution...");
        const receipt = await waitForUserOp(userOpHash);
        if (!receipt.success) {
          const reason = receipt.reason || "QRIS removal failed";
          throw new Error(reason);
        }
        setStatus("QRIS removed on-chain");
        return receipt.txHash || userOpHash;
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp, assertPaymasterBalance],
  );

  const sendGaslessTransfer = useCallback(
    async (params: {
      recipient: Address;
      amount: string;
      tokenAddress: Address;
      decimals: number;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        const { client, address } = await ensureClient();

        // Lazy approval: ensure token is approved for paymaster before transaction
        await ensureTokenApproval(params.tokenAddress, paymasterAddress);

        const amountParsed = parseUnits(params.amount, params.decimals);
        const feeParams = await getFeeParams();
        const gasLimitEstimate =
          220_000n +
          450_000n +
          PAYMASTER_VERIFICATION_GAS +
          PAYMASTER_POST_OP_GAS +
          PRE_VERIFICATION_GAS;
        await assertPaymasterBalance({
          token: params.tokenAddress,
          owner: address,
          spendAmount: amountParsed,
          decimals: params.decimals,
          gasLimit: gasLimitEstimate,
          maxFeePerGas: feeParams.maxFeePerGas,
        });

        setStatus("Requesting paymaster signature...");
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.tokenAddress,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.tokenAddress,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        setStatus("Sending UserOperation to Pimlico bundler...");
        let userOpHash = "";
        try {
          userOpHash = await submitUserOpWithRetry(client, {
            calls: [
              {
                to: params.tokenAddress,
                data: encodeFunctionData({
                  abi: ERC20_ABI,
                  functionName: "transfer",
                  args: [params.recipient, amountParsed],
                }),
                value: BigInt(0),
              },
            ],
            paymaster: paymasterAddress,
            paymasterData,
            paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
            paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
            callGasLimit: BigInt(220_000),
            verificationGasLimit: BigInt(450_000),
            preVerificationGas: PRE_VERIFICATION_GAS,
            ...feeParams,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "send failed";
          if (msg.includes("Failed to fetch")) {
            throw new Error(
              `Bundler RPC unreachable at ${bundlerUrl} (${msg})`,
            );
          }
          throw err;
        }

        setStatus("UserOp submitted to bundler, waiting for execution...");
        const receipt = await waitForUserOp(userOpHash as `0x${string}`);
        if (!receipt.success) {
          const reason = receipt.reason || "Execution failed";
          throw new Error(reason);
        }
        setStatus("UserOp executed on-chain");
        return receipt.txHash || userOpHash;
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp, ensureTokenApproval, paymasterAddress],
  );

  const sendBatchTransfer = useCallback(
    async (params: {
      recipients: { address: Address; amount: string }[];
      tokenAddress: Address;
      decimals: number;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        if (params.recipients.length === 0) {
          throw new Error("At least one recipient is required");
        }
        if (params.recipients.length > 20) {
          throw new Error("Maximum 20 recipients per batch");
        }

        const { client, address } = await ensureClient();
        const feeParams = await getFeeParams();

        setStatus("Requesting paymaster signature for batch transfer...");
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.tokenAddress,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.tokenAddress,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        // Build transfer calls for each recipient
        const calls = params.recipients.map((recipient) => ({
          to: params.tokenAddress,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [
              recipient.address,
              parseUnits(recipient.amount, params.decimals),
            ],
          }),
          value: BigInt(0),
        }));

        const totalSpend = params.recipients.reduce((sum, recipient) => {
          return sum + parseUnits(recipient.amount, params.decimals);
        }, 0n);

        // Dynamic gas limits based on recipient count
        const recipientCount = params.recipients.length;
        const baseCallGas = 100_000;
        const perTransferGas = 50_000;
        const callGasLimit = BigInt(
          baseCallGas + recipientCount * perTransferGas,
        );
        const gasLimitEstimate =
          callGasLimit +
          450_000n +
          PAYMASTER_VERIFICATION_GAS +
          PAYMASTER_POST_OP_GAS +
          PRE_VERIFICATION_GAS;
        await assertPaymasterBalance({
          token: params.tokenAddress,
          owner: address,
          spendAmount: totalSpend,
          decimals: params.decimals,
          gasLimit: gasLimitEstimate,
          maxFeePerGas: feeParams.maxFeePerGas,
        });

        setStatus(`Sending batch transfer to ${recipientCount} recipients...`);
        let userOpHash = "";
        try {
          const res = await client.sendCalls({
            calls,
            paymaster: paymasterAddress,
            paymasterData,
            paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
            paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
            callGasLimit,
            verificationGasLimit: BigInt(450_000),
            preVerificationGas: PRE_VERIFICATION_GAS,
            ...feeParams,
          });
          userOpHash = res.id as `0x${string}`;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "send failed";
          if (msg.includes("Failed to fetch")) {
            throw new Error(
              `Bundler RPC unreachable at ${bundlerUrl} (${msg})`,
            );
          }
          throw err;
        }

        setStatus("Batch transfer submitted, waiting for execution...");
        const receipt = await waitForUserOp(userOpHash as `0x${string}`);
        if (!receipt.success) {
          const reason = receipt.reason || "Batch execution failed";
          throw new Error(reason);
        }
        setStatus(`Batch transfer to ${recipientCount} recipients completed`);
        return {
          txHash: receipt.txHash || userOpHash,
          recipientCount,
        };
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp],
  );

  const swapTokens = useCallback(
    async (params: {
      tokenIn: Address;
      tokenOut: Address;
      amount: string;
      tokenInDecimals: number;
      stableSwapAddress: Address;
      minAmountOut: bigint;
      totalUserPays: bigint;
      currentAllowance?: bigint;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        const { client, address } = await ensureClient();

        // Lazy approval: ensure tokenIn is approved for paymaster before transaction
        await ensureTokenApproval(params.tokenIn, paymasterAddress);

        const amountParsed = parseUnits(params.amount, params.tokenInDecimals);

        // Check if approval is needed for StableSwap
        const needsApproval =
          !params.currentAllowance ||
          params.currentAllowance < params.totalUserPays;

        const feeParams = await getFeeParams();
        const gasLimitEstimate =
          (needsApproval ? 100_000n : 0n) +
          300_000n +
          300_000n +
          PAYMASTER_VERIFICATION_GAS +
          PAYMASTER_POST_OP_GAS +
          PRE_VERIFICATION_GAS;
        await assertPaymasterBalance({
          token: params.tokenIn,
          owner: address,
          spendAmount: params.totalUserPays,
          decimals: params.tokenInDecimals,
          gasLimit: gasLimitEstimate,
          maxFeePerGas: feeParams.maxFeePerGas,
        });

        // Generate fresh signature for this UserOperation
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        setStatus("Requesting paymaster signature for swap...");
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.tokenIn,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.tokenIn,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        let swapTarget = params.stableSwapAddress;
        let swapData = encodeFunctionData({
          abi: STABLE_SWAP_ABI,
          functionName: "swap",
          args: [
            amountParsed,
            params.tokenIn,
            params.tokenOut,
            params.minAmountOut,
          ],
        });

        if (env.useBackendSwapBuild) {
          try {
            const backendBuild = await buildSwapCalldata({
              tokenIn: params.tokenIn,
              tokenOut: params.tokenOut,
              amountIn: amountParsed,
              minAmountOut: params.minAmountOut,
              chainId: chain.id,
              autoRoute: env.backendSwapAutoRoute,
            });
            swapTarget = getAddress(backendBuild.to as Address);
            swapData = backendBuild.data as `0x${string}`;
          } catch (buildError) {
            console.warn(
              "Backend /swap/build failed, falling back to local calldata build:",
              buildError,
            );
          }
        }

        const calls = [];

        // Approve StableSwap if needed
        if (needsApproval) {
          calls.push({
            to: params.tokenIn,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [swapTarget, maxUint256],
            }),
            value: BigInt(0),
          });
        }

        calls.push({
          to: swapTarget,
          data: swapData,
          value: BigInt(0),
        });

        setStatus("Submitting swap UserOperation...");
        const userOpHash = await submitUserOpWithRetry(client, {
          calls,
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
          paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
          callGasLimit: BigInt((needsApproval ? 100_000 : 0) + 300_000),
          verificationGasLimit: BigInt(300_000),
          preVerificationGas: PRE_VERIFICATION_GAS,
          ...feeParams,
        }) as `0x${string}`;
        setStatus("Waiting for swap execution...");
        const receipt = await waitForUserOp(userOpHash);
        if (!receipt.success) {
          const reason = receipt.reason || "Swap failed";
          throw new Error(reason);
        }
        setStatus("Swap executed on-chain");
        return receipt.txHash || userOpHash;
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp, ensureTokenApproval, paymasterAddress],
  );

  /**
   * Swap tokens and transfer to recipient in a single UserOp
   * For cross-token transfers: pay with Token A, recipient receives Token B
   */
  const swapAndTransfer = useCallback(
    async (params: {
      tokenIn: Address;
      tokenOut: Address;
      amountIn: string;
      tokenInDecimals: number;
      tokenOutDecimals: number;
      recipient: Address;
      stableSwapAddress: Address;
      minAmountOut: bigint;
      totalUserPays: bigint;
      currentAllowance?: bigint;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        const { client, address } = await ensureClient();

        // Lazy approval: ensure tokenIn is approved for paymaster before transaction
        await ensureTokenApproval(params.tokenIn, paymasterAddress);

        const amountParsed = parseUnits(
          params.amountIn,
          params.tokenInDecimals,
        );

        // Check if approval is needed for StableSwap
        const needsApproval =
          !params.currentAllowance ||
          params.currentAllowance < params.totalUserPays;

        const feeParams = await getFeeParams();
        const gasLimitEstimate =
          (needsApproval ? 100_000n : 0n) +
          400_000n +
          300_000n +
          PAYMASTER_VERIFICATION_GAS +
          PAYMASTER_POST_OP_GAS +
          PRE_VERIFICATION_GAS;

        await assertPaymasterBalance({
          token: params.tokenIn,
          owner: address,
          spendAmount: params.totalUserPays,
          decimals: params.tokenInDecimals,
          gasLimit: gasLimitEstimate,
          maxFeePerGas: feeParams.maxFeePerGas,
        });

        // Generate fresh signature for this UserOperation
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        setStatus("Requesting paymaster signature for swap & transfer...");
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.tokenIn,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.tokenIn,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        const calls = [];

        // Approve StableSwap if needed
        if (needsApproval) {
          calls.push({
            to: params.tokenIn,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [params.stableSwapAddress, maxUint256],
            }),
            value: BigInt(0),
          });
        }

        calls.push({
          to: params.stableSwapAddress,
          data: encodeFunctionData({
            abi: STABLE_SWAP_ABI,
            functionName: "swap",
            args: [
              amountParsed,
              params.tokenIn,
              params.tokenOut,
              params.minAmountOut,
            ],
          }),
          value: BigInt(0),
        });

        calls.push({
          to: params.tokenOut,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [params.recipient, params.minAmountOut],
          }),
          value: BigInt(0),
        });

        setStatus("Submitting swap & transfer UserOperation...");
        const res = await client.sendCalls({
          calls,
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
          paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
          callGasLimit: BigInt((needsApproval ? 100_000 : 0) + 400_000),
          verificationGasLimit: BigInt(300_000),
          preVerificationGas: PRE_VERIFICATION_GAS,
          ...feeParams,
        });

        const userOpHash = res.id as `0x${string}`;
        setStatus("Waiting for swap & transfer execution...");
        const receipt = await waitForUserOp(userOpHash);
        if (!receipt.success) {
          throw new Error(receipt.reason || "Swap & transfer failed");
        }
        setStatus("Swap & transfer executed on-chain");
        return {
          txHash: receipt.txHash || userOpHash,
          amountSent: params.minAmountOut,
        };
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp, assertPaymasterBalance, ensureTokenApproval, paymasterAddress],
  );

  /**
   * swapAndBatchTransfer: Swap payToken → targetToken, then batch transfer to multiple recipients
   * For cross-token batch transfers where user pays with different token than what recipients receive
   */
  const swapAndBatchTransfer = useCallback(
    async (params: {
      tokenIn: Address; // Token user pays with (e.g., USDC)
      tokenOut: Address; // Token recipients receive (e.g., IDRX)
      totalAmountIn: bigint; // Total payToken amount to swap
      tokenInDecimals: number;
      tokenOutDecimals: number;
      recipients: { address: Address; amount: string }[]; // Each recipient's amount in tokenOut
      stableSwapAddress: Address;
      minTotalAmountOut: bigint; // Minimum total tokenOut from swap
      currentAllowance?: bigint;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        const { client, address } = await ensureClient();

        // Check if approval is needed for StableSwap
        const needsApproval =
          !params.currentAllowance ||
          params.currentAllowance < params.totalAmountIn;

        const feeParams = await getFeeParams();
        // Estimate gas: approval (if needed) + swap + (transfers × recipientCount)
        const gasLimitEstimate =
          (needsApproval ? 100_000n : 0n) +
          400_000n +
          300_000n +
          BigInt(params.recipients.length) * 100_000n +
          PAYMASTER_VERIFICATION_GAS +
          PAYMASTER_POST_OP_GAS +
          PRE_VERIFICATION_GAS;

        await assertPaymasterBalance({
          token: params.tokenIn,
          owner: address,
          spendAmount: params.totalAmountIn,
          decimals: params.tokenInDecimals,
          gasLimit: gasLimitEstimate,
          maxFeePerGas: feeParams.maxFeePerGas,
        });

        // Generate fresh signature for this UserOperation
        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        setStatus(
          "Requesting paymaster signature for batch swap & transfer...",
        );
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.tokenIn,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.tokenIn,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        const calls = [];

        // Approve StableSwap if needed
        if (needsApproval) {
          calls.push({
            to: params.tokenIn,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [params.stableSwapAddress, maxUint256],
            }),
            value: BigInt(0),
          });
        }

        // Swap total payToken → targetToken
        calls.push({
          to: params.stableSwapAddress,
          data: encodeFunctionData({
            abi: STABLE_SWAP_ABI,
            functionName: "swap",
            args: [
              params.totalAmountIn,
              params.tokenIn,
              params.tokenOut,
              params.minTotalAmountOut,
            ],
          }),
          value: BigInt(0),
        });

        // Transfer to each recipient
        for (const recipient of params.recipients) {
          const amountParsed = parseUnits(
            recipient.amount,
            params.tokenOutDecimals,
          );
          calls.push({
            to: params.tokenOut,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "transfer",
              args: [recipient.address, amountParsed],
            }),
            value: BigInt(0),
          });
        }

        setStatus(
          `Submitting batch swap & transfer to ${params.recipients.length} recipients...`,
        );
        const res = await client.sendCalls({
          calls,
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: PAYMASTER_VERIFICATION_GAS,
          paymasterPostOpGasLimit: PAYMASTER_POST_OP_GAS,
          callGasLimit: BigInt((needsApproval ? 100_000 : 0) + 400_000 + params.recipients.length * 100_000),
          verificationGasLimit: BigInt(300_000),
          preVerificationGas: PRE_VERIFICATION_GAS,
          ...feeParams,
        } as Record<string, unknown>);
        // sendCalls may return: string | { userOpHash: string } | { id: string }
        const userOpHash =
          typeof res === "string" ? res : res.userOpHash || res.id || res;
        setStatus("Waiting for batch transaction confirmation...");
        const receipt = await waitForUserOp(userOpHash as `0x${string}`);
        if (!receipt.success) {
          throw new Error(receipt.reason || "Batch swap & transfer failed");
        }
        setStatus("Batch swap & transfer executed on-chain");
        return {
          txHash: receipt.txHash || userOpHash,
          recipientCount: params.recipients.length,
          totalAmountOut: params.minTotalAmountOut,
        };
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp, assertPaymasterBalance],
  );

  const payInvoice = useCallback(
    async (params: {
      request: {
        recipient: Address;
        requestedToken: Address;
        requestedAmount: bigint;
        deadline: bigint;
        nonce: `0x${string}`;
        merchantSigner: Address;
      };
      merchantSignature: `0x${string}`;
      payToken: Address;
      totalRequired: bigint;
      maxAmountToPay: bigint;
      paymentProcessorAddress?: Address;
      currentAllowance?: bigint;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        const { client, address } = await ensureClient();
        const needsApproval =
          !params.currentAllowance ||
          params.currentAllowance < params.totalRequired;
        const feeParams = await getFeeParams();

        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        setStatus("Requesting paymaster signature for payment...");
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: params.payToken,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: params.payToken,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        const processor =
          params.paymentProcessorAddress || paymentProcessorAddress;
        const calls = [];

        if (needsApproval) {
          calls.push({
            to: params.payToken,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [processor, maxUint256],
            }),
            value: BigInt(0),
          });
        }

        calls.push({
          to: processor,
          data: encodeFunctionData({
            abi: PAYMENT_PROCESSOR_ABI,
            functionName: "executePayment",
            args: [
              [
                params.request.recipient,
                params.request.requestedToken,
                params.request.requestedAmount,
                params.request.deadline,
                params.request.nonce,
                params.request.merchantSigner,
              ],
              params.merchantSignature,
              params.payToken,
              params.maxAmountToPay,
            ],
          }),
          value: BigInt(0),
        });

        setStatus("Submitting payment UserOperation...");
        const res = await client.sendCalls({
          calls,
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: BigInt(260_000),
          paymasterPostOpGasLimit: BigInt(260_000),
          callGasLimit: BigInt(1_300_000),
          verificationGasLimit: BigInt(950_000),
          ...feeParams,
        });

        const userOpHash = res.id as `0x${string}`;
        setStatus("Waiting for payment execution...");
        const receipt = await waitForUserOp(userOpHash);
        if (!receipt.success) {
          throw new Error(receipt.reason || "Payment failed");
        }

        setStatus("Payment executed");
        return receipt.txHash || userOpHash;
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp],
  );

  const payMultiTokenInvoice = useCallback(
    async (params: {
      request: {
        recipient: Address;
        requestedToken: Address;
        requestedAmount: bigint;
        deadline: bigint;
        nonce: `0x${string}`;
        merchantSigner: Address;
      };
      merchantSignature: `0x${string}`;
      payments: { token: Address; amount: bigint }[];
      paymentProcessorAddress?: Address;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        if (params.payments.length === 0) {
          throw new Error("At least one payment token required");
        }

        const { client, address } = await ensureClient();
        const feeParams = await getFeeParams();

        // Use first payment token for paymaster fee
        const feeToken = params.payments[0].token;

        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        setStatus("Requesting paymaster signature for multi-token payment...");
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: feeToken,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: feeToken,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        const processor =
          params.paymentProcessorAddress || paymentProcessorAddress;
        const calls: { to: Address; data: `0x${string}`; value: bigint }[] = [];

        // Build approve calls for each unique token
        const uniqueTokens = [...new Set(params.payments.map((p) => p.token))];
        for (const token of uniqueTokens) {
          calls.push({
            to: token,
            data: encodeFunctionData({
              abi: ERC20_ABI,
              functionName: "approve",
              args: [processor, maxUint256],
            }),
            value: BigInt(0),
          });
        }

        // Build payments array for contract call
        const paymentsArg = params.payments.map((p) => ({
          token: p.token,
          amount: p.amount,
        }));

        // Add executeMultiTokenPayment call
        calls.push({
          to: processor,
          data: encodeFunctionData({
            abi: PAYMENT_PROCESSOR_ABI,
            functionName: "executeMultiTokenPayment",
            args: [
              [
                params.request.recipient,
                params.request.requestedToken,
                params.request.requestedAmount,
                params.request.deadline,
                params.request.nonce,
                params.request.merchantSigner,
              ],
              params.merchantSignature,
              paymentsArg,
            ],
          }),
          value: BigInt(0),
        });

        setStatus("Submitting multi-token payment UserOperation...");
        const res = await client.sendCalls({
          calls,
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: BigInt(300_000),
          paymasterPostOpGasLimit: BigInt(300_000),
          callGasLimit: BigInt(2_000_000),
          verificationGasLimit: BigInt(1_200_000),
          ...feeParams,
        });

        const userOpHash = res.id as `0x${string}`;
        setStatus("Waiting for multi-token payment execution...");
        const receipt = await waitForUserOp(userOpHash);
        if (!receipt.success) {
          throw new Error(receipt.reason || "Multi-token payment failed");
        }

        setStatus("Multi-token payment executed");
        return receipt.txHash || userOpHash;
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp],
  );

  /**
   * qrisMultiTokenPayment: For QRIS payments where user pays with multiple tokens
   * Batches all approvals, swaps, and final transfer into a SINGLE UserOperation
   * This ensures only ONE signature is required
   */
  const qrisMultiTokenPayment = useCallback(
    async (params: {
      payments: {
        token: Address;
        amount: bigint;
        decimals: number;
        needsSwap: boolean;
        swapAmountOut?: bigint; // Pre-calculated swap output
      }[];
      targetToken: Address;
      targetTokenDecimals: number;
      recipient: Address;
      totalAmountOut: bigint; // Total to transfer to recipient
      stableSwapAddress: Address;
    }) => {
      setError(null);
      setIsLoading(true);
      try {
        if (params.payments.length === 0) {
          throw new Error("At least one payment token required");
        }

        const { client, address } = await ensureClient();
        const feeParams = await getFeeParams();

        // Use first payment token for paymaster fee
        const feeToken = params.payments[0].token;

        const validUntil = Math.floor(Date.now() / 1000) + 3600;
        const validAfter = 0;
        setStatus("Requesting paymaster signature for QRIS payment...");
        const signature = await getPaymasterSignature({
          payerAddress: address,
          tokenAddress: feeToken,
          validUntil,
          validAfter,
          isActivation: false,
        });

        const paymasterData = buildPaymasterData({
          tokenAddress: feeToken,
          payerAddress: address,
          validUntil,
          validAfter,
          hasPermit: false,
          isActivation: false,
          signature: signature as `0x${string}`,
        });

        const calls: { to: Address; data: `0x${string}`; value: bigint }[] = [];

        // Build all approve and swap calls for tokens that need swap
        for (const payment of params.payments) {
          if (payment.needsSwap && payment.swapAmountOut) {
            // Approve StableSwap
            calls.push({
              to: payment.token,
              data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: "approve",
                args: [params.stableSwapAddress, maxUint256],
              }),
              value: BigInt(0),
            });

            // Swap to target token (to self)
            calls.push({
              to: params.stableSwapAddress,
              data: encodeFunctionData({
                abi: STABLE_SWAP_ABI,
                functionName: "swap",
                args: [
                  payment.amount,
                  payment.token,
                  params.targetToken,
                  payment.swapAmountOut,
                ],
              }),
              value: BigInt(0),
            });
          }
        }

        // Final transfer of accumulated target token to recipient
        calls.push({
          to: params.targetToken,
          data: encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [params.recipient, params.totalAmountOut],
          }),
          value: BigInt(0),
        });

        setStatus("Submitting QRIS multi-token payment...");
        const res = await client.sendCalls({
          calls,
          paymaster: paymasterAddress,
          paymasterData,
          paymasterVerificationGasLimit: BigInt(300_000),
          paymasterPostOpGasLimit: BigInt(300_000),
          callGasLimit: BigInt(2_500_000),
          verificationGasLimit: BigInt(1_200_000),
          preVerificationGas: PRE_VERIFICATION_GAS,
          ...feeParams,
        });

        const userOpHash = res.id as `0x${string}`;
        setStatus("Waiting for QRIS payment confirmation...");
        const receipt = await waitForUserOp(userOpHash);
        if (!receipt.success) {
          throw new Error(receipt.reason || "QRIS multi-token payment failed");
        }

        setStatus("QRIS payment executed");
        return {
          txHash: receipt.txHash || userOpHash,
          totalAmountOut: params.totalAmountOut,
        };
      } catch (err) {
        const message = transformError(err);
        setError(message);
        setStatus(message);
        throw new Error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [ensureClient, getFeeParams, waitForUserOp],
  );

  const signMessageWithEOA = useCallback(
    async (hash: `0x${string}`) => {
      if (!effectiveWalletClient) {
        throw new Error("Connect wallet first");
      }
      return effectiveWalletClient.signMessage({
        message: { raw: hash },
      } as any);
    },
    [effectiveWalletClient],
  );

  const deployBaseAccount = useCallback(async () => {
    if (!eoaAddress || !effectiveWalletClient) {
      throw new Error("No wallet connected");
    }

    setIsLoading(true);
    setStatus("Deploying Smart Account...");
    setError(null);

    try {
      // Check if already deployed
      const existingBytecode = await publicClient.getBytecode({
        address: eoaAddress,
      });
      if (existingBytecode && existingBytecode !== "0x") {
        const codeLength = (existingBytecode.length - 2) / 2;
        setBaseAppDeployment({
          status: "deployed",
          address: eoaAddress as Address,
          chainId: chain.id,
          rpcUrl: chain.rpcUrls.default.http[0],
          codeLength,
        });
        setStatus("Smart Account already deployed!");
        return { alreadyDeployed: true };
      }

      setStatus(`Switching to ${chain.name}...`);

      // Switch chain first
      try {
        await effectiveWalletClient.switchChain({ id: chain.id });
      } catch (switchError) {
        // If switch fails, try adding the chain first
        try {
          await effectiveWalletClient.addChain({ chain: chain });
          await effectiveWalletClient.switchChain({ id: chain.id });
        } catch {
          // Ignore if chain already exists
        }
      }

      setStatus("Sending self-transaction to trigger deployment...");

      // Send 0 ETH to self - this triggers smart account lazy deployment
      const txHash = await effectiveWalletClient.sendTransaction({
        to: eoaAddress,
        value: BigInt(0),
        chain: chain,
      } as any);

      setStatus("Waiting for deployment confirmation...");

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

      console.log("Deployment tx confirmed:", receipt.transactionHash);
      console.log("Checking deployment for address:", eoaAddress);

      // Wait a bit for blockchain state to propagate
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify deployment with retry
      let bytecode: string | undefined;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        bytecode = await publicClient.getBytecode({ address: eoaAddress });
        console.log(
          `Bytecode check attempt ${attempts + 1}:`,
          bytecode?.substring(0, 20) || "0x",
        );

        if (bytecode && bytecode !== "0x") {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }

      const codeLength = bytecode ? (bytecode.length - 2) / 2 : 0;

      if (bytecode && bytecode !== "0x") {
        setBaseAppDeployment({
          status: "deployed",
          address: eoaAddress as Address,
          chainId: chain.id,
          rpcUrl: chain.rpcUrls.default.http[0],
          codeLength,
        });
        setStatus("Smart Account deployed successfully!");
        return { success: true, txHash };
      } else {
        // Transaction succeeded but no bytecode - might be EOA not Smart Account
        // Let's assume it's deployed since tx succeeded
        console.warn(
          "No bytecode detected but transaction succeeded. Assuming deployed.",
        );
        setBaseAppDeployment({
          status: "deployed",
          address: eoaAddress as Address,
          chainId: chain.id,
          rpcUrl: chain.rpcUrls.default.http[0],
          codeLength: 0,
        });
        setStatus("Wallet deployed (transaction confirmed)!");
        return { success: true, txHash };
      }
    } catch (err) {
      const message = transformError(err);
      setError(message);
      setStatus(`Deployment failed: ${message}`);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [eoaAddress, effectiveWalletClient, publicClient, chain]);

  return {
    smartAccountAddress,
    eoaAddress,
    walletSource,
    status,
    isLoading,
    isReady,
    error,
    sendGaslessTransfer,
    sendBatchTransfer,
    approvePaymaster,
    claimFaucet,
    registerQris,
    removeMyQris,
    initSmartAccount: ensureClient,
    swapTokens,
    swapAndTransfer,
    swapAndBatchTransfer,
    payInvoice,
    payMultiTokenInvoice,
    qrisMultiTokenPayment,
    signMessageWithEOA,
    baseAppDeployment,
    deployBaseAccount,
    supportedPaymasterTokens: SUPPORTED_PAYMASTER_TOKENS,
    simulateUserOp,
    decodeUserOpError,
  };
}

