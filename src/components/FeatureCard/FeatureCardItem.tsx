"use client";

import React, { useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger
if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

interface FeatureCardItemProps {
    imageDefault: string;
    imageHover: string;
    title: string;
    description: string;
}

export default function FeatureCardItem({
    imageDefault,
    imageHover,
    title,
    description
}: FeatureCardItemProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const yellowOverlayRef = useRef<HTMLDivElement>(null);
    const hoverImageContainerRef = useRef<HTMLDivElement>(null);
    const bottomSectionRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                paused: true,
                defaults: { duration: 0.5, ease: "power2.inOut" }
            });

            // Set up the animation sequence (same as hover)
            tl.to(cardRef.current, { scale: 1.02, duration: 0.3, ease: "power2.out" }, 0)
                .to(yellowOverlayRef.current, { x: 0 }, 0)
                .to(hoverImageContainerRef.current, { x: 0 }, 0)
                .to(bottomSectionRef.current, { backgroundColor: "#252525", duration: 0.3 }, 0);

            // Responsive ScrollTrigger dengan matchMedia
            const mm = gsap.matchMedia();

            // Desktop (landscape) - viewport lebih lebar
            mm.add("(min-width: 768px)", () => {
                ScrollTrigger.create({
                    trigger: cardRef.current,
                    start: "top 60%", // Trigger lebih dalam untuk desktop
                    end: "bottom 40%", // End point lebih tinggi
                    onEnter: () => tl.play(),
                    onLeave: () => tl.reverse(),
                    onEnterBack: () => tl.play(),
                    onLeaveBack: () => tl.reverse(),
                    // markers: true, // Uncomment untuk debugging
                });
            });

            // Mobile (portrait) - viewport lebih sempit dan tinggi
            mm.add("(max-width: 767px)", () => {
                ScrollTrigger.create({
                    trigger: cardRef.current,
                    start: "top 40%", // Trigger lebih lambat untuk mobile
                    end: "bottom 40%", // End point lebih rendah
                    onEnter: () => tl.play(),
                    onLeave: () => tl.reverse(),
                    onEnterBack: () => tl.play(),
                    onLeaveBack: () => tl.reverse(),
                    // markers: true, // Uncomment untuk debugging
                });
            });
        }, cardRef);

        return () => ctx.revert();
    }, []);

    return (
        <div
            ref={cardRef}
            className="w-full flex flex-col items-center justify-center bg-black-second rounded-3xl sm:rounded-4xl overflow-hidden border border-white/5 transition-transform duration-300"
        >
            {/* Top Section / Image Area */}
            <div className="relative w-full h-64 sm:h-72 lg:h-80 overflow-hidden flex items-center justify-center">

                {/* 1. Default Image Layer (Bottom) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                        src={imageDefault}
                        alt={`${title} Default`}
                        className="w-32 h-32 sm:w-36 sm:h-36 lg:w-40 lg:h-40 object-contain"
                    />
                </div>

                {/* 2. Yellow Swipe Overlay Layer (Top) */}
                <div
                    ref={yellowOverlayRef}
                    className="absolute inset-0 bg-yellow-prime -translate-x-[101%] overflow-hidden z-10"
                >
                    {/* 3. Hover Image Container (Slides opposite to parent to stay centered) */}
                    <div
                        ref={hoverImageContainerRef}
                        className="absolute inset-0 flex items-center justify-center translate-x-[101%]"
                    >
                        <img
                            src={imageHover}
                            alt={`${title} Hover`}
                            className="w-32 h-32 sm:w-36 sm:h-36 lg:w-40 lg:h-40 object-contain"
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Section */}
            <div
                ref={bottomSectionRef}
                className="px-8 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-10 w-full flex flex-col gap-2 sm:gap-3 text-white transition-colors duration-300 z-20"
            >
                <div className="text-base sm:text-2xl lg:text-3xl font-thin">
                    {title}
                </div>
                <div className="text-xs sm:text-base lg:text-lg text-white/80 leading-relaxed font-thin">
                    {description}
                </div>
            </div>
        </div>
    );
}
