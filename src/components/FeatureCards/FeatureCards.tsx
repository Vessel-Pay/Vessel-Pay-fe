"use client";

import { FeatureCardEffect, FeatureCardItem } from './FeatureCardItem';
import { useScroll, useTransform } from "motion/react";
import React, { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register GSAP ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Section Title Component with GSAP scroll-triggered animation on "Vessel Pay"
const SectionTitle = () => {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const vesselPayRef = useRef<HTMLSpanElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!vesselPayRef.current || !highlightRef.current || !containerRef.current) return;

    const vesselPayEl = vesselPayRef.current;
    const highlightEl = highlightRef.current;
    const textEl = vesselPayEl.querySelector('.vessel-pay-text') as Element;

    // Set initial state - highlight hidden to the left
    gsap.set(highlightEl, {
      scaleX: 0,
      transformOrigin: "left center",
      backgroundColor: "#D89B00"
    });

    // Create scroll-triggered animation
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 80%", // Animation starts when element is at 80% from top of viewport
        end: "top 50%",   // Animation ends when element is at 50% from top of viewport
        toggleActions: "play none none reverse", // play on enter, reverse on leave
      }
    });

    // Animate highlight from left to right
    tl.to(highlightEl, {
      scaleX: 1,
      duration: 0.5,
      ease: "power2.out"
    });

    // Change text color to black (slightly delayed)
    tl.to(textEl, {
      color: "#000000",
      duration: 0.3,
    }, "-=0.3"); // Overlap with previous animation

    return () => {
      tl.kill();
      ScrollTrigger.getAll().forEach(trigger => {
        if (trigger.trigger === containerRef.current) {
          trigger.kill();
        }
      });
    };
  }, []);

  return (
    <h2
      ref={containerRef}
      className="font-hero font-bold text-3xl md:text-5xl lg:text-6xl text-white text-center mb-8 md:mb-16"
    >
      Why choose{" "}
      <span
        ref={vesselPayRef}
        className="relative inline-block px-2 md:px-4"
      >
        {/* Background highlight element */}
        <span
          ref={highlightRef}
          className="absolute inset-0 z-0"
          style={{ backgroundColor: "#D89B00" }}
        />
        {/* Text element */}
        <span className="vessel-pay-text relative z-10 text-white">
          Vessel Pay?
        </span>
      </span>
    </h2>
  );
};

export default function FeatureCards() {
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    // "start end" = progress 0 ketika top container baru menyentuh bottom viewport
    // "start center" = progress 1 ketika top container mencapai 50% viewport (center)
    offset: ["start end", "start center"],
  });

  // Animation completes at 100% scroll progress (when section reaches 50% viewport)
  // pathLength selesai di progress 1.0 (tepat di 50% viewport)
  const pathLengthFirst = useTransform(scrollYProgress, [0, 1], [0, 1]);

  // Content opacity: fade in di akhir animasi (0.7 to 1.0)
  const contentOpacity = useTransform(scrollYProgress, [0.7, 1], [0, 1]);

  const pathLengthSecond = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const pathLengthThird = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const pathLengthFourth = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const pathLengthFifth = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const features: FeatureCardItem[] = [
    {
      title: "Multichain Ready",
      description:
        "Runs on Base Sepolia and Etherlink Shadownet for seamless multi-chain payments.",
    },
    {
      title: "Gasless Transactions",
      description:
        "Using Paymaster (ERC-4337) pay gas fees directly with stablecoins. No ETH required.",
    },
    {
      title: "Auto-Swap Engine",
      description: "Pay with any token you hold, settle in the token merchants need automatically.",
    },
    {
      title: "QR Payment",
      description: "Fast and convenient payment between users.",
    },
  ];

  return (
    // Container untuk scroll tracking
    // Height cukup untuk memberikan ruang scroll selama animasi
    <div
      className="min-h-[140vh] bg-black w-full relative pt-20 md:pt-32"
      ref={ref}
      style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
    >
      {/* Section Title */}
      <div className="w-full flex justify-center px-4">
        <SectionTitle />
      </div>

      {/* Feature Cards */}
      <FeatureCardEffect
        items={features}
        contentOpacity={contentOpacity}
        pathLengths={[
          pathLengthFirst,
          pathLengthSecond,
          pathLengthThird,
          pathLengthFourth,
          pathLengthFifth,
        ]}
      />
    </div>
  );
}
