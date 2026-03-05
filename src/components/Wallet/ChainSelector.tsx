"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import {
  CHAIN_CONFIGS,
  CHAIN_KEYS,
  type ChainKey,
} from "@/config/chains";
import { useActiveChain } from "@/hooks/useActiveChain";

export default function ChainSelector() {
  const { chainKey, setChainKey } = useActiveChain();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = CHAIN_CONFIGS[chainKey];

  const handleSelect = (key: ChainKey) => {
    setChainKey(key);
    setIsOpen(false);
  };

  const getChainIcon = (key: ChainKey) =>
    key === "etherlink_shadownet" ? "/etherlink.png" : "/base.png";

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-xl text-zinc-200 text-xs sm:text-sm border border-zinc-700 hover:border-zinc-600 transition-colors max-w-[180px] sm:max-w-none"
      >
        <Image
          src={getChainIcon(chainKey)}
          alt={current.chain.name}
          width={16}
          height={16}
          className="rounded-full"
        />
        <div className="flex items-center gap-1 min-w-0">
          <span className="font-semibold truncate">{current.chain.name}</span>
          <span className="text-zinc-400 shrink-0">
            ({current.nativeCurrency.symbol})
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full min-w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden">
          {CHAIN_KEYS.map((key) => {
            const chain = CHAIN_CONFIGS[key];
            const isActive = key === chainKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSelect(key)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors ${
                  isActive ? "bg-zinc-700 text-white" : "text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Image
                    src={getChainIcon(key)}
                    alt={chain.chain.name}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                  <span className="font-medium">{chain.chain.name}</span>
                </div>
                <div className="text-xs text-zinc-400">
                  Chain ID {chain.chain.id} - {chain.nativeCurrency.symbol}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
