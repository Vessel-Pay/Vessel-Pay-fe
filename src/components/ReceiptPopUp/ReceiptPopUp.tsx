"use client";

import { ReceiptData } from './Receipt';
import SuccessReceipt from './SuccessReceipt';
import FailedReceipt from './FailedReceipt';

interface ReceiptPopUpProps {
  isOpen: boolean;
  data: ReceiptData | null;
  onClose: () => void;
}

export default function ReceiptPopUp({ isOpen, data, onClose }: ReceiptPopUpProps) {
  if (!isOpen || !data) return null;
  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {data.status === 'success' ? (
          <SuccessReceipt data={data} onContinue={onClose} />
        ) : (
          <FailedReceipt errorMessage={data.errorMessage} onContinue={onClose} />
        )}
      </div>
    </div>
  );
}
