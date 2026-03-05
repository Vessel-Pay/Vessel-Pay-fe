import { memo, ReactNode } from 'react';

interface MenuItemProps {
    icon: ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const MenuItem = memo(function MenuItem({
    icon,
    label,
    isActive,
    onClick,
}: MenuItemProps) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col border border-black/0 justify-center items-center p-1.5 sm:p-2.5 rounded-md cursor-pointer transition-all
            ${isActive ? "border-primary text-primary" : "text-accent"} bg-dark-accent hover:bg-dark-accent/80`}
        >
            <div>{icon}</div>
            <div className='font-sans font-regular text-[10px] sm:text-xs md:text-sm'>{label}</div>
        </button>
    );
})

export default MenuItem;