"use client";

import Image from "next/image";
import { Currency } from "@/components/Currency";

interface CurrencyBadgeProps {
  currency: Currency;
  onClick: () => void;
}

export default function CurrencyBadge({
  currency,
  onClick,
}: CurrencyBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 sm:gap-2 sm:px-3 sm:py-2 bg-zinc-800 rounded-full border border-zinc-700 hover:border-zinc-500 transition-colors cursor-pointer shrink-0"
    >
      <Image
        src={currency.icon}
        alt={currency.name}
        width={20}
        height={20}
        className="rounded-full sm:w-6 sm:h-6"
      />
      <span className="text-white font-medium text-sm sm:text-base">
        {currency.symbol}
      </span>
    </button>
  );
}
