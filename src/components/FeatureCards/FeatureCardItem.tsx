"use client";
import { cn } from "@/lib/utils";
import { motion, MotionValue, useInView } from "motion/react";
import { useRef } from "react";

export interface FeatureCardItem {
  title: string;
  description: string;
}

export const FeatureCardEffect = ({
  pathLengths,
  contentOpacity,
  items,
  className,
}: {
  pathLengths: MotionValue[];
  contentOpacity: MotionValue;
  items: FeatureCardItem[];
  className?: string;
}) => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });

  return (
    // Sticky container dengan vertical centering
    <div
      ref={containerRef}
      className={cn(
        "sticky top-0 min-h-screen w-full flex items-center justify-center py-8 md:py-20 px-4",
        className
      )}
    >
      {/* Cards Container - Grid: 2 cols on mobile (2+1 layout), 3 cols on desktop */}
      <div className="grid grid-cols-2 md:flex md:flex-row gap-4 md:gap-10 items-stretch justify-center max-w-lg md:max-w-none">
        {items.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 50 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{
              duration: 0.6,
              delay: index * 0.15,
              ease: "easeOut"
            }}
            whileHover="hover"
            variants={{
              hover: {
                scale: 1.05,
                backgroundColor: "#D89B00",
                transition: { duration: 0.3, ease: "easeOut" }
              }
            }}
            className={cn(
              "relative w-full md:w-[300px] lg:w-[340px] h-[220px] md:h-[400px] lg:h-[440px]",
              "flex items-start justify-center pt-8 md:pt-12 px-4 md:px-8",
              "bg-transparent border-2 border-[#C9A227] rounded-2xl cursor-pointer",
              "transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(216,155,0,0.5)]",
              // Third card spans full width on mobile and is centered
              index === 2 && "col-span-2 mx-auto max-w-[50%] md:max-w-none"
            )}
          >
            {/* Content - Animated opacity, aligned left inside centered group */}
            <motion.div
              className="relative z-10 flex flex-col items-start gap-2 md:gap-5 text-left"
              style={{ opacity: contentOpacity }}
            >
              <motion.h3
                className="font-hero text-base md:text-2xl lg:text-3xl leading-tight font-semibold"
                style={{ fontVariant: 'small-caps' }}
                initial={{ color: "#C9A227" }}
                variants={{
                  hover: { color: "#000000", transition: { duration: 0.3 } }
                }}
              >
                {item.title}
              </motion.h3>
              <motion.p
                className="font-sans text-xs md:text-base lg:text-lg leading-relaxed"
                initial={{ color: "#FFFFFF" }}
                variants={{
                  hover: { color: "#000000", transition: { duration: 0.3 } }
                }}
              >
                {item.description}
              </motion.p>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};