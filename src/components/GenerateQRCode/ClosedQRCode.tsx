import Image from 'next/image';
import QRIcon from '@/assets/QR_Icon.svg';

export default function ClosedQRCode() {
  return (
    <div className="w-full max-w-sm p-8 border-2 border-dashed border-accent rounded-xl">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-accent text-sm">
          Generate QR Code to<br />Receive Token
        </p>
        <div className="flex items-center gap-3">
          <Image src={QRIcon} alt="QR" width={40} height={40} />
          <p className="text-accent text-sm">
            Your QR code<br />goes here
          </p>
        </div>
      </div>
    </div>
  );
}
