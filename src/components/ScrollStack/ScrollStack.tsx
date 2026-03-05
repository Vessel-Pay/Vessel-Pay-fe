import React, { useLayoutEffect, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

export interface ScrollStackItemProps {
    itemClassName?: string;
    children?: ReactNode;
    image?: string;
    label?: string;
    description?: string;
}

export const ScrollStackItem: React.FC<ScrollStackItemProps> = ({
    children,
    itemClassName = '',
    image,
    label,
    description
}) => (
    <div
        className={`scroll-stack-card relative w-full h-[300px] md:h-[500px] my-4 md:my-8 rounded-[24px] md:rounded-[40px] shadow-[0_0_30px_rgba(0,0,0,0.1)] overflow-hidden box-border origin-top will-change-transform ${itemClassName}`.trim()}
        style={{
            backfaceVisibility: 'hidden',
            transformStyle: 'preserve-3d'
        }}
    >
        {image && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <img
                    src={image}
                    alt={label || 'Stack item'}
                    className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-primary/20 to-transparent pointer-events-none" />
            </div>
        )}

        <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-12">
            {label && (
                <h3 className="text-white text-2xl md:text-4xl font-bold mb-2 md:mb-3 font-hero">{label}</h3>
            )}
            {description && (
                <p className="text-white/90 text-sm md:text-lg mb-2 md:mb-4 font-sans">{description}</p>
            )}
            {children}
        </div>
    </div>
);

interface ScrollStackProps {
    className?: string;
    children: ReactNode;
    itemDistance?: number;
    itemScale?: number;
    itemStackDistance?: number;
    stackPosition?: string;
    scaleEndPosition?: string;
    baseScale?: number;
    scaleDuration?: number;
    rotationAmount?: number;
    blurAmount?: number;
    useWindowScroll?: boolean;
    onStackComplete?: () => void;
}

// Register GSAP ScrollTrigger plugin
if (typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
}

// Section Title Component with GSAP scroll-triggered underline animation
const SectionTitle: React.FC = () => {
    const titleRef = useRef<HTMLHeadingElement>(null);
    const underlineRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!titleRef.current || !underlineRef.current) return;

        const underlineEl = underlineRef.current;

        // Set initial state - underline hidden to the left
        gsap.set(underlineEl, {
            scaleX: 0,
            transformOrigin: "left center"
        });

        // Create scroll-triggered animation
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: titleRef.current,
                start: "top 85%", // Animation starts when element is at 85% from top of viewport
                end: "top 60%",   // Animation ends when element is at 60% from top of viewport
                toggleActions: "play none none reverse", // play on enter, reverse on leave
            }
        });

        // Animate underline from left to right
        tl.to(underlineEl, {
            scaleX: 1,
            duration: 0.6,
            ease: "power2.out"
        });

        return () => {
            tl.kill();
            ScrollTrigger.getAll().forEach(trigger => {
                if (trigger.trigger === titleRef.current) {
                    trigger.kill();
                }
            });
        };
    }, []);

    return (
        <h2
            ref={titleRef}
            className="font-hero font-bold text-3xl md:text-5xl lg:text-6xl text-white text-center mb-8 md:mb-12 relative inline-block"
        >
            <span className="relative">
                How it works?
                {/* Underline element */}
                <span
                    ref={underlineRef}
                    className="absolute left-0 right-0 bottom-0 h-[3px] md:h-[4px] lg:h-[5px]"
                    style={{
                        backgroundColor: "#D89B00",
                        transform: "translateY(4px)"
                    }}
                />
            </span>
        </h2>
    );
};

const ScrollStack: React.FC<ScrollStackProps> = ({
    children,
    className = '',
    itemDistance = 100,
    itemScale = 0.03,
    itemStackDistance = 30,
    stackPosition = '20%',
    scaleEndPosition = '10%',
    baseScale = 0.85,
    scaleDuration = 0.5,
    rotationAmount = 0,
    blurAmount = 0,
    useWindowScroll = false,
    onStackComplete
}) => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const stackCompletedRef = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const lenisRef = useRef<Lenis | null>(null);
    const cardsRef = useRef<HTMLElement[]>([]);
    const lastTransformsRef = useRef(new Map<number, any>());
    const isUpdatingRef = useRef(false);

    const calculateProgress = useCallback((scrollTop: number, start: number, end: number) => {
        if (scrollTop < start) return 0;
        if (scrollTop > end) return 1;
        return (scrollTop - start) / (end - start);
    }, []);

    const parsePercentage = useCallback((value: string | number, containerHeight: number) => {
        if (typeof value === 'string' && value.includes('%')) {
            return (parseFloat(value) / 100) * containerHeight;
        }
        return parseFloat(value as string);
    }, []);

    const getScrollData = useCallback(() => {
        if (useWindowScroll) {
            return {
                scrollTop: window.scrollY,
                containerHeight: window.innerHeight,
                scrollContainer: document.documentElement
            };
        } else {
            const scroller = scrollerRef.current;
            return {
                scrollTop: scroller ? scroller.scrollTop : 0,
                containerHeight: scroller ? scroller.clientHeight : 0,
                scrollContainer: scroller
            };
        }
    }, [useWindowScroll]);

    const getElementOffset = useCallback(
        (element: HTMLElement) => {
            if (useWindowScroll) {
                const rect = element.getBoundingClientRect();
                return rect.top + window.scrollY;
            } else {
                return element.offsetTop;
            }
        },
        [useWindowScroll]
    );

    const updateCardTransforms = useCallback(() => {
        if (!cardsRef.current.length || isUpdatingRef.current) return;

        isUpdatingRef.current = true;

        const { scrollTop, containerHeight, scrollContainer } = getScrollData();
        const stackPositionPx = parsePercentage(stackPosition, containerHeight);
        const scaleEndPositionPx = parsePercentage(scaleEndPosition, containerHeight);

        const endElement = useWindowScroll
            ? (document.querySelector('.scroll-stack-end') as HTMLElement | null)
            : (scrollerRef.current?.querySelector('.scroll-stack-end') as HTMLElement | null);

        const endElementTop = endElement ? getElementOffset(endElement) : 0;

        cardsRef.current.forEach((card, i) => {
            if (!card) return;

            const cardTop = getElementOffset(card);
            const triggerStart = cardTop - stackPositionPx - itemStackDistance * i;
            const triggerEnd = cardTop - scaleEndPositionPx;
            const pinStart = cardTop - stackPositionPx - itemStackDistance * i;
            const pinEnd = endElementTop - containerHeight / 2;

            const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd);
            const targetScale = baseScale + i * itemScale;
            const scale = 1 - scaleProgress * (1 - targetScale);
            const rotation = rotationAmount ? i * rotationAmount * scaleProgress : 0;

            let blur = 0;
            if (blurAmount) {
                let topCardIndex = 0;
                for (let j = 0; j < cardsRef.current.length; j++) {
                    const jCardTop = getElementOffset(cardsRef.current[j]);
                    const jTriggerStart = jCardTop - stackPositionPx - itemStackDistance * j;
                    if (scrollTop >= jTriggerStart) {
                        topCardIndex = j;
                    }
                }

                if (i < topCardIndex) {
                    const depthInStack = topCardIndex - i;
                    blur = Math.max(0, depthInStack * blurAmount);
                }
            }

            let translateY = 0;
            const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd;

            if (isPinned) {
                translateY = scrollTop - cardTop + stackPositionPx + itemStackDistance * i;
            } else if (scrollTop > pinEnd) {
                translateY = pinEnd - cardTop + stackPositionPx + itemStackDistance * i;
            }

            const newTransform = {
                translateY: Math.round(translateY * 100) / 100,
                scale: Math.round(scale * 1000) / 1000,
                rotation: Math.round(rotation * 100) / 100,
                blur: Math.round(blur * 100) / 100
            };

            const lastTransform = lastTransformsRef.current.get(i);
            const hasChanged =
                !lastTransform ||
                Math.abs(lastTransform.translateY - newTransform.translateY) > 1 ||
                Math.abs(lastTransform.scale - newTransform.scale) > 0.005 ||
                Math.abs(lastTransform.rotation - newTransform.rotation) > 0.5 ||
                Math.abs(lastTransform.blur - newTransform.blur) > 0.2;

            if (hasChanged) {
                const transform = `translate3d(0, ${newTransform.translateY}px, 0) scale(${newTransform.scale}) rotate(${newTransform.rotation}deg)`;
                const filter = newTransform.blur > 0 ? `blur(${newTransform.blur}px)` : '';

                card.style.transform = transform;
                card.style.filter = filter;

                lastTransformsRef.current.set(i, newTransform);
            }

            if (i === cardsRef.current.length - 1) {
                const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
                if (isInView && !stackCompletedRef.current) {
                    stackCompletedRef.current = true;
                    onStackComplete?.();
                } else if (!isInView && stackCompletedRef.current) {
                    stackCompletedRef.current = false;
                }
            }
        });

        isUpdatingRef.current = false;
    }, [
        itemScale,
        itemStackDistance,
        stackPosition,
        scaleEndPosition,
        baseScale,
        rotationAmount,
        blurAmount,
        useWindowScroll,
        onStackComplete,
        calculateProgress,
        parsePercentage,
        getScrollData,
        getElementOffset
    ]);

    const handleScroll = useCallback(() => {
        updateCardTransforms();
    }, [updateCardTransforms]);

    const setupLenis = useCallback(() => {
        if (useWindowScroll) {
            const lenis = new Lenis({
                duration: 1.0,
                easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                smoothWheel: true,
                touchMultiplier: 1.5,
                infinite: false,
                wheelMultiplier: 0.8,
                lerp: 0.15,
                syncTouch: true,
                syncTouchLerp: 0.1
            });

            lenis.on('scroll', handleScroll);

            const raf = (time: number) => {
                lenis.raf(time);
                animationFrameRef.current = requestAnimationFrame(raf);
            };
            animationFrameRef.current = requestAnimationFrame(raf);

            lenisRef.current = lenis;
            return lenis;
        } else {
            const scroller = scrollerRef.current;
            if (!scroller) return;

            const lenis = new Lenis({
                wrapper: scroller,
                content: scroller.querySelector('.scroll-stack-inner') as HTMLElement,
                duration: 1.2,
                easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                smoothWheel: true,
                touchMultiplier: 2,
                infinite: false,
                gestureOrientation: 'vertical',
                wheelMultiplier: 1,
                lerp: 0.1,
                syncTouch: true,
                syncTouchLerp: 0.075
            });

            lenis.on('scroll', handleScroll);

            const raf = (time: number) => {
                lenis.raf(time);
                animationFrameRef.current = requestAnimationFrame(raf);
            };
            animationFrameRef.current = requestAnimationFrame(raf);

            lenisRef.current = lenis;
            return lenis;
        }
    }, [handleScroll, useWindowScroll]);

    useLayoutEffect(() => {
        if (!useWindowScroll && !scrollerRef.current) return;

        const cards = Array.from(
            useWindowScroll
                ? document.querySelectorAll('.scroll-stack-card')
                : (scrollerRef.current?.querySelectorAll('.scroll-stack-card') ?? [])
        ) as HTMLElement[];
        cardsRef.current = cards;
        const transformsCache = lastTransformsRef.current;

        cards.forEach((card, i) => {
            if (i < cards.length - 1) {
                card.style.marginBottom = `${itemDistance}px`;
            }
            card.style.willChange = 'transform, filter';
            card.style.transformOrigin = 'top center';
            card.style.backfaceVisibility = 'hidden';
            card.style.transform = 'translateZ(0)';
            card.style.webkitTransform = 'translateZ(0)';
            card.style.perspective = '1000px';
            card.style.webkitPerspective = '1000px';
            card.style.transition = 'transform 0.1s ease-out, filter 0.1s ease-out';
        });

        setupLenis();

        updateCardTransforms();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (lenisRef.current) {
                lenisRef.current.destroy();
            }
            stackCompletedRef.current = false;
            cardsRef.current = [];
            transformsCache.clear();
            isUpdatingRef.current = false;
        };
    }, [
        itemDistance,
        itemScale,
        itemStackDistance,
        stackPosition,
        scaleEndPosition,
        baseScale,
        scaleDuration,
        rotationAmount,
        blurAmount,
        useWindowScroll,
        onStackComplete,
        setupLenis,
        updateCardTransforms
    ]);

    return (
        <div
            className={`relative w-full h-full overflow-y-auto overflow-x-visible ${className}`.trim()}
            ref={scrollerRef}
            style={{
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'smooth',
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                willChange: 'scroll-position'
            }}
        >
            <div className="scroll-stack-inner pt-[10vh] px-4 md:px-20 pb-[30rem] min-h-screen">
                {/* Section Title with underline animation */}
                <div className="w-full flex justify-center mb-8 md:mb-16">
                    <SectionTitle />
                </div>
                {children}
                {/* Spacer so the last pin can release cleanly */}
                <div className="scroll-stack-end w-full h-px" />
            </div>
        </div>
    );
};

export default ScrollStack;
