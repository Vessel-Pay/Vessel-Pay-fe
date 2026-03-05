"use client";

import Image from "next/image";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import {
  ReceiptData,
  formatReceiptDate,
  formatReceiptTime,
  shortenAddress,
} from "./Receipt";
import SuccessIcon from "@/assets/Success.svg";

interface SuccessReceiptProps {
  data: ReceiptData;
  onContinue: () => void;
}

export default function SuccessReceipt({
  data,
  onContinue,
}: SuccessReceiptProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const addressToCopy =
      data.type === "send" ? data.toAddress : data.fromAddress;
    if (addressToCopy) {
      await navigator.clipboard.writeText(addressToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getTransactionLabel = () => {
    switch (data.type) {
      case "send":
        return "Send Token";
      case "receive":
        return "Receive Token";
      case "swap":
        return "Swap Token";
    }
  };

  const getAddressLabel = () => {
    switch (data.type) {
      case "send":
        return "Sent to";
      case "receive":
        return "Received from";
      case "swap":
        return "Swapped via";
    }
  };

  const displayAddress =
    data.type === "send" ? data.toAddress : data.fromAddress;

  return (
    <div className="bg-zinc-800 rounded-2xl p-5 sm:p-6 w-full max-w-md">
      {/* Success Icon */}
      <div className="flex flex-col items-center mb-4 sm:mb-5">
        <Image src={SuccessIcon} alt="Success" width={56} height={56} />
        <p className="text-primary font-medium mt-2 text-sm sm:text-base">
          Success!
        </p>
      </div>
      {/* Receipt Title */}
      <h2 className="text-white text-base sm:text-lg font-bold text-center mb-4 sm:mb-5">
        Transaction Receipt
      </h2>
      {/* Receipt Details */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex justify-between items-center gap-4">
          <span className="text-zinc-400 text-xs sm:text-sm">Date</span>
          <span className="text-white text-xs sm:text-sm">
            {formatReceiptDate(data.timestamp)}
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-zinc-400 text-xs sm:text-sm">Time</span>
          <span className="text-white text-xs sm:text-sm">
            {formatReceiptTime(data.timestamp)}
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-zinc-400 text-xs sm:text-sm">Transaction</span>
          <span className="text-white font-medium text-xs sm:text-sm">
            {getTransactionLabel()}
          </span>
        </div>
        {displayAddress && (
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-400 text-xs sm:text-sm">
              {getAddressLabel()}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-mono text-xs sm:text-sm">
                {shortenAddress(displayAddress)}
              </span>
              <button
                onClick={handleCopy}
                className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center gap-4">
          <span className="text-zinc-400 text-xs sm:text-sm">
            Sender's currency
          </span>
          <div className="flex items-center gap-1.5">
            <Image
              src={data.senderCurrencyIcon || data.currencyIcon}
              alt=""
              width={18}
              height={18}
            />
            <span className="text-white text-xs sm:text-sm">
              {data.senderCurrency || data.currency}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center gap-4">
          <span className="text-zinc-400 text-xs sm:text-sm">
            Receiver's currency
          </span>
          <div className="flex items-center gap-1.5">
            {data.type === "swap" && data.swapToCurrencyIcon ? (
              <>
                <Image
                  src={data.swapToCurrencyIcon}
                  alt=""
                  width={18}
                  height={18}
                />
                <span className="text-white text-xs sm:text-sm">
                  {data.swapToCurrency}
                </span>
              </>
            ) : (
              <>
                <Image src={data.currencyIcon} alt="" width={18} height={18} />
                <span className="text-white text-xs sm:text-sm">
                  {data.currency}
                </span>
              </>
            )}
          </div>
        </div>
        {/* Separator */}
        <div className="border-t border-zinc-700 pt-3 sm:pt-4">
          <div className="flex justify-between items-center gap-4">
            <span className="text-zinc-400 text-xs sm:text-sm">
              Total Amount
            </span>
            <span className="text-xs sm:text-sm">
              <span className="text-primary font-bold">{data.amount}</span>
              <span className="text-white ml-1">{data.currency}</span>
            </span>
          </div>
          {data.type === "swap" && data.swapToAmount && (
            <div className="flex justify-between items-center gap-4 mt-2">
              <span className="text-zinc-400 text-xs sm:text-sm">
                Converted to
              </span>
              <span className="text-xs sm:text-sm">
                <span className="text-primary font-bold">
                  {data.swapToAmount}
                </span>
                <span className="text-white ml-1">{data.swapToCurrency}</span>
              </span>
            </div>
          )}
          {/* Multi-token breakdown */}
          {data.tokenBreakdown && data.tokenBreakdown.length > 1 && (
            <div className="mt-3 pt-3 border-t border-zinc-700/50">
              <span className="text-zinc-400 text-xs block mb-2">
                Paid with:
              </span>
              <div className="space-y-1">
                {data.tokenBreakdown.map((token) => (
                  <div
                    key={token.symbol}
                    className="flex justify-between items-center gap-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <Image src={token.icon} alt="" width={14} height={14} />
                      <span className="text-zinc-300 text-xs">
                        {token.symbol}
                      </span>
                    </div>
                    <span className="text-white text-xs font-mono">
                      {token.amount.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Continue Button */}
      <button
        onClick={onContinue}
        className="w-full mt-4 sm:mt-5 py-3 border-2 border-primary text-primary font-bold text-sm sm:text-base rounded-xl hover:bg-primary/10 transition-colors cursor-pointer"
      >
        CONTINUE
      </button>
    </div>
  );
}
