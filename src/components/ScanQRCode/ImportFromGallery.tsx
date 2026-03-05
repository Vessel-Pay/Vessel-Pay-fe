"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import jsQR from "jsqr";
import ImportIcon from "@/assets/Import_From_Gallery.svg";
import Modal from "@/components/Modal";

interface ImportFromGalleryProps {
  onImport: (result: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

export default function ImportFromGallery({
  onImport,
  onError,
  disabled,
}: ImportFromGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: "", message: "" });

  const handleClick = () => {
    if (disabled || isProcessing) {
      return;
    }
    fileInputRef.current?.click();
  };

  const processImage = async (file: File): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          // Create canvas to process image
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            reject("Cannot create canvas context");
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          // Get image data for QR detection
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Decode QR code
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            resolve(code.data);
          } else {
            reject("QR Code tidak ditemukan dalam gambar");
          }
        };
        img.onerror = () => {
          reject("Gagal memuat gambar");
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject("Gagal membaca file");
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset state
    setError(null);
    setIsProcessing(true);
    // Validate file type
    if (!file.type.startsWith("image/")) {
      const errorMsg = "File harus berupa gambar (PNG, JPG, dll)";
      setError(errorMsg);
      onError?.(errorMsg);
      setIsProcessing(false);
      return;
    }
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      const errorMsg = "Ukuran file terlalu besar (max 10MB)";
      setError(errorMsg);
      onError?.(errorMsg);
      setIsProcessing(false);
      return;
    }
    try {
      const result = await processImage(file);
      if (result) {
        setError(null);
        onImport(result);
      }
    } catch (err) {
      const errorMsg = typeof err === "string" ? err : "Gagal memproses QR Code";
      onError?.(errorMsg);
      setErrorModal({
        isOpen: true,
        title: "Import Failed",
        message: errorMsg,
      });
    } finally {
      setIsProcessing(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const isDisabled = disabled || isProcessing;

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 border border-accent rounded-lg transition-colors text-xs ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent/10"
          }`}
      >
        <Image src={ImportIcon} alt="Import" width={16} height={16} />
        <span className="text-white font-medium">
          {isProcessing ? "Processing..." : "Import from gallery"}
        </span>
      </button>

      {/* Error Modal */}
      <Modal
        id="import-error-modal"
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
