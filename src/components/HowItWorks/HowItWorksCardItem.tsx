"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import howItWorksBg from "@/assets/how-it-works-bg.png";

interface HowItWorksCardItemProps {
    image?: string;
    images?: string[];
    title: string;
    description: string;
    isReversed?: boolean;
    steps?: string[];
    autoSwipeInterval?: number; // in milliseconds, default 4000
}

export default function HowItWorksCardItem({
    image,
    images,
    title,
    description,
    isReversed,
    steps,
    autoSwipeInterval = 4000
}: HowItWorksCardItemProps) {
    // Normalize images to always be an array
    const imageList = images || (image ? [image] : []);
    const hasMultipleImages = imageList.length > 1;

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    // Auto-swipe functionality
    useEffect(() => {
        if (!hasMultipleImages || isPaused) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % imageList.length);
        }, autoSwipeInterval);

        return () => clearInterval(interval);
    }, [hasMultipleImages, isPaused, imageList.length, autoSwipeInterval]);

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
    }, [imageList.length]);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % imageList.length);
    }, [imageList.length]);

    const goToSlide = useCallback((index: number) => {
        setCurrentIndex(index);
    }, []);

    return (
        <div className={`flex flex-col lg:flex-row w-full h-fit lg:min-h-[600px] rounded-[2rem] sm:rounded-4xl overflow-hidden border border-white/10 ${isReversed ? "lg:flex-row-reverse" : ""}`}>
            {/* Image Section */}
            <div
                className="relative bg-black-third flex items-center justify-center overflow-hidden w-full lg:w-1/2 aspect-square lg:aspect-auto"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
            >
                <Image src={howItWorksBg} alt="" className="absolute inset-0 w-full h-full object-cover" />

                {/* Carousel Container */}
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                    {/* Images */}
                    <div className="relative w-full h-full">
                        {imageList.map((img, idx) => (
                            <div
                                key={idx}
                                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${idx === currentIndex ? "opacity-100" : "opacity-0"
                                    }`}
                            >
                                <Image
                                    src={img}
                                    alt={`${title} ${idx + 1}`}
                                    width={600}
                                    height={600}
                                    className="w-full h-full object-contain p-4 sm:p-6 lg:p-8"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Navigation Buttons - Only show if multiple images */}
                    {hasMultipleImages && (
                        <>
                            {/* Left Button */}
                            <button
                                onClick={goToPrevious}
                                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-all duration-200 backdrop-blur-sm border border-white/20"
                                aria-label="Previous image"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>

                            {/* Right Button */}
                            <button
                                onClick={goToNext}
                                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-all duration-200 backdrop-blur-sm border border-white/20"
                                aria-label="Next image"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 sm:w-5 sm:h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>

                            {/* Dot Pagination */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                {imageList.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => goToSlide(idx)}
                                        className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all duration-300 ${idx === currentIndex
                                            ? "bg-black-third w-4 sm:w-6"
                                            : "bg-white hover:bg-white/60"
                                            }`}
                                        aria-label={`Go to slide ${idx + 1}`}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Content Section */}
            <div className="bg-black-second flex flex-col w-full lg:w-1/2 h-auto px-8 sm:px-12 lg:px-20 py-10 lg:py-16 justify-center gap-6 text-white text-left transition-all duration-300">
                <div className="flex flex-col gap-4 items-start">
                    <span className="text-base sm:text-2xl lg:text-3xl font-thin">{title}</span>
                    <span className="text-xs sm:text-base lg:text-lg text-white/80 leading-relaxed font-thin">{description}</span>

                    {steps && steps.length > 0 && (
                        <ol className="list-decimal list-inside text-xs sm:text-base lg:text-lg text-white/80 space-y-2 ml-1 mt-4 text-left lg:mx-0 max-w-md font-thin">
                            {steps.map((step, idx) => (
                                <li key={idx} className="pl-1">{step}</li>
                            ))}
                        </ol>
                    )}
                </div>
            </div>
        </div>
    )
}