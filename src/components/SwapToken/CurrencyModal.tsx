"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useMemo } from "react";
import { Currency, buildCurrencies } from "@/components/Currency";
import { useActiveChain } from "@/hooks/useActiveChain";

interface CurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (currency: Currency) => void;
  excludeCurrency?: Currency; // Currency to exclude from list
}

export default function CurrencyModal({
  isOpen,
  onClose,
  onSelect,
  excludeCurrency,
}: CurrencyModalProps) {
  if (!isOpen) return null;
  const { config } = useActiveChain();
  const currencies = useMemo(() => buildCurrencies(config), [config]);
  const availableCurrencies = currencies.filter(
    (c) => c.id !== excludeCurrency?.id
  );

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-zinc-800 rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
          <span />
          <h3 className="text-white font-bold text-center">Select Currency</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {availableCurrencies.map((currency) => (
            <button
              key={currency.id}
              onClick={() => {
                onSelect(currency);
                onClose();
              }}
              className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              <Image
                src={currency.icon}
                alt={currency.name}
                width={32}
                height={32}
                className="rounded-full sm:w-10 sm:h-10"
              />
              <div className="text-left">
                <p className="text-white font-medium text-sm sm:text-base">{currency.name}</p>
                <p className="text-zinc-400 text-xs sm:text-sm">{currency.symbol}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
