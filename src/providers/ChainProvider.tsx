"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import {
  CHAIN_CONFIGS,
  CHAIN_KEYS,
  DEFAULT_CHAIN_KEY,
  type ChainKey,
  type ChainRuntimeConfig,
} from "@/config/chains";

const STORAGE_KEY = "artapay_active_chain";

type ChainContextValue = {
  chainKey: ChainKey;
  config: ChainRuntimeConfig;
  setChainKey: (key: ChainKey) => void;
};

const ChainContext = createContext<ChainContextValue | null>(null);

const normalizeChainKey = (value: string): ChainKey | null => {
  const raw = value.trim().toLowerCase();
  if (raw === "base" || raw === "base_sepolia" || raw === "84532") {
    return "base_sepolia";
  }
  if (
    raw === "etherlink" ||
    raw === "etherlink_shadownet" ||
    raw === "shadownet" ||
    raw === "127823"
  ) {
    return "etherlink_shadownet";
  }
  return null;
};

export function ChainProvider({ children }: { children: React.ReactNode }) {
  const [chainKey, setChainKey] = useState<ChainKey>(DEFAULT_CHAIN_KEY);
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const config = useMemo(() => CHAIN_CONFIGS[chainKey], [chainKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const normalized = normalizeChainKey(stored);
      if (normalized && CHAIN_KEYS.includes(normalized)) {
        setChainKey(normalized);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, chainKey);
  }, [chainKey]);

  useEffect(() => {
    if (!switchChainAsync) return;
    if (!chainId || chainId === config.chain.id) return;
    switchChainAsync({ chainId: config.chain.id }).catch(() => {});
  }, [chainId, config.chain.id, switchChainAsync]);

  return (
    <ChainContext.Provider value={{ chainKey, config, setChainKey }}>
      {children}
    </ChainContext.Provider>
  );
}

export function useChainContext() {
  const ctx = useContext(ChainContext);
  if (!ctx) {
    throw new Error("useChainContext must be used within ChainProvider");
  }
  return ctx;
}
