import Image from "next/image";
import CameraIcon from "@/assets/Camera.svg";

interface ClosedCameraProps {
  onScanNow: () => void;
  disabled?: boolean;
}

export default function ClosedCamera({ onScanNow, disabled }: ClosedCameraProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Camera Preview Box - Square */}
      <div className="w-full max-w-[280px] aspect-square p-4 sm:p-6 border-2 border-dashed border-accent rounded-xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-accent text-xs sm:text-sm">
            Allow this website to<br />use your camera
          </p>
          <div className="flex items-center gap-3">
            <Image src={CameraIcon} alt="Camera" width={40} height={40} />
            <p className="text-accent text-xs sm:text-sm">
              Your QR code<br />goes here
            </p>
          </div>
        </div>
      </div>
      {/* Scan Now Button */}
      <button
        onClick={onScanNow}
        disabled={disabled}
        className={`w-full max-w-sm py-3 sm:py-4 bg-primary text-black font-bold text-base sm:text-lg md:text-xl rounded-xl transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-primary/90"
          }`}
      >
        SCAN NOW
      </button>
    </div>
  );
}
