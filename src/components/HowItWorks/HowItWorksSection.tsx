"use client";

import HowItWorksCard from "./HowItWorksCard";

export default function HowItWorksSection() {
    return (
        <div className="w-full h-auto flex justify-center">
            <div className="w-full max-w-7xl px-10 sm:px-8 lg:px-12 gap-16 flex flex-col items-center">
                <div className="flex flex-col items-center gap-4">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-thin text-white text-center">How It Works</h2>
                    <p className="text-xs sm:text-base lg:text-lg text-white/80 leading-relaxed font-thin text-center max-w-2xl mt-[-1rem]">
                        Follow these simple steps to start your gasless journey with Vessel Pay.
                        Experience seamless transactions across multiple chains without ever worrying about gas fees.
                    </p>
                </div>
                <HowItWorksCard />
            </div>
        </div>
    )
}