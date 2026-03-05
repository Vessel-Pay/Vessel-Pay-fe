"use client";

import Image from 'next/image';
import FailedIcon from '@/assets/Failed.svg';

interface FailedReceiptProps {
  errorMessage?: string;
  onContinue: () => void;
}

export default function FailedReceipt({ errorMessage, onContinue }: FailedReceiptProps) {
  return (
    <div className="bg-zinc-800 rounded-2xl p-4 sm:p-6 w-full max-w-md">
      {/* Failed Icon */}
      <div className="flex flex-col items-center mb-6">
        <Image src={FailedIcon} alt="Failed" width={60} height={60} />
        <p className="text-red-500 font-medium mt-2">Oops, Failed</p>
      </div>

      {/* Message */}
      <h2 className="text-white text-xl font-bold text-center mb-2">
        Retry your transaction!
      </h2>
      {errorMessage && (
        <p className="text-zinc-400 text-sm text-center mb-6">
          {errorMessage}
        </p>
      )}

      {/* Continue Button */}
      <button
        onClick={onContinue}
        className="w-full mt-4 sm:mt-6 py-3 sm:py-4 border-2 border-primary text-primary font-bold text-base sm:text-lg md:text-xl rounded-xl hover:bg-primary/10 transition-colors cursor-pointer"
      >
        CONTINUE
      </button>
    </div>
  );
}
