"use client";

import React from "react";

interface CoinMarqueeCardProps {
    icon: string;
    name: string;
}

export default function CoinMarqueeCard({ icon, name }: CoinMarqueeCardProps) {
    return (
        <div className="group flex flex-col items-center justify-center gap-3 px-6 py-4 bg-transparent border border-black-second rounded-2xl transition-all duration-300 hover:border-white/20 min-w-[140px]">
            {/* Icon dengan opacity rendah, naik saat hover */}
            <img
                src={icon}
                alt={name}
                className="w-12 h-12 sm:w-14 sm:h-14 object-contain opacity-40 group-hover:opacity-100 transition-opacity duration-300"
            />

            {/* Title dengan font-thin */}
            <p className="text-xs sm:text-base lg:text-lg font-thin text-white/80 group-hover:text-white transition-colors duration-300">
                {name}
            </p>
        </div>
    );
}
