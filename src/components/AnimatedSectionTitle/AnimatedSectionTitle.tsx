"use client";

import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

interface AnimatedSectionTitleProps {
    children: string;
    className?: string;
    variant?: 'default' | 'gradient' | 'outline' | 'glitch';
}

export default function AnimatedSectionTitle({
    children,
    className = '',
    variant = 'default'
}: AnimatedSectionTitleProps) {
    const titleRef = useRef<HTMLHeadingElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!titleRef.current || !containerRef.current) return;

        const ctx = gsap.context(() => {
            // Split into words
            const words = children.split(' ');
            titleRef.current!.innerHTML = words
                .map((word, i) => {
                    return `<span class="inline-block overflow-hidden"><span class="inline-block word-${i}">${word}</span></span>${i < words.length - 1 ? '&nbsp;' : ''}`;
                })
                .join('');

            const wordElements = titleRef.current!.querySelectorAll(`[class*="word-"]`);

            // Scroll-triggered animation
            gsap.fromTo(
                wordElements,
                {
                    y: '100%',
                    opacity: 0,
                    rotateX: -90,
                },
                {
                    y: '0%',
                    opacity: 1,
                    rotateX: 0,
                    duration: 0.8,
                    stagger: 0.1,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top 80%',
                        end: 'top 50%',
                        toggleActions: 'play none none reverse',
                    },
                }
            );

            // Variant-specific effects
            if (variant === 'gradient') {
                gsap.to(titleRef.current, {
                    backgroundPosition: '200% center',
                    duration: 4,
                    repeat: -1,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top 80%',
                    },
                });
            }

            if (variant === 'glitch') {
                // Glitch effect on scroll in
                const glitchTimeline = gsap.timeline({
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top 80%',
                    },
                });

                glitchTimeline
                    .to(titleRef.current, {
                        textShadow: '2px 2px #D89B00, -2px -2px #fff',
                        duration: 0.1,
                        repeat: 3,
                        yoyo: true,
                    })
                    .to(titleRef.current, {
                        textShadow: 'none',
                        duration: 0.1,
                    });
            }
        }, containerRef);

        return () => ctx.revert();
    }, [children, variant]);

    const variantClasses = {
        default: 'text-white',
        gradient: 'text-transparent bg-clip-text bg-gradient-to-r from-primary via-yellow-300 to-primary',
        outline: 'text-transparent',
        glitch: 'text-white',
    };

    const variantStyles = {
        default: {},
        gradient: {
            backgroundSize: '200% auto',
        },
        outline: {
            WebkitTextStroke: '2px #D89B00',
        },
        glitch: {},
    };

    return (
        <div ref={containerRef} className="overflow-hidden hidden md:block">
            <h2
                ref={titleRef}
                className={`${variantClasses[variant]} ${className}`}
                style={{
                    perspective: '1000px',
                    transformStyle: 'preserve-3d',
                    ...variantStyles[variant],
                }}
            >
                {children}
            </h2>
        </div>
    );
}
