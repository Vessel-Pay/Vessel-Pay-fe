import { memo, ReactNode } from 'react';

interface MethodItemProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const SendMethodItem = memo(function SendMethodItem({
    label,
    isActive,
    onClick,
}: MethodItemProps) {
    return (
        <button
            onClick={onClick}
            className={`flex justify-center border border-white/0 items-center py-2 sm:py-2.5 w-1/2 rounded-full cursor-pointer transition-all font-sans font-regular text-[11px] sm:text-xs md:text-sm
            ${isActive ? "bg-primary border border-primary text-black font-medium scale-105" : "text-white/80"}`}
        >
            {label}
        </button>
    )
})

export default SendMethodItem;