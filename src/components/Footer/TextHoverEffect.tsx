"use client";
import React, { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bebas_Neue } from "next/font/google";

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
});

export const TextHoverEffect = ({
  text = "ARTAPAY",
  duration,
}: {
  text?: string;
  duration?: number;
  automatic?: boolean;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    if (svgRef.current && cursor.x !== null && cursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
      const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      });
    }
  }, [cursor]);

  return (
    <div
      className="w-full flex items-center justify-center overflow-hidden"
      style={{ cursor: "crosshair", height: "auto" }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox="0 0 950 300"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
        className="select-none w-full"
      >
        <defs>
          <linearGradient
            id="textGradient"
            gradientUnits="userSpaceOnUse"
            cx="50%"
            cy="50%"
            r="25%"
          >
            {hovered && (
              <>
                <stop offset="0%" stopColor="#D89B00" />
                <stop offset="25%" stopColor="#D89B00" />
                <stop offset="50%" stopColor="#D89B00" />
                <stop offset="75%" stopColor="#D89B00" />
                <stop offset="100%" stopColor="#D89B00" />
              </>
            )}
          </linearGradient>

          <motion.radialGradient
            id="revealMask"
            gradientUnits="userSpaceOnUse"
            r="20%"
            initial={{ cx: "50%", cy: "50%" }}
            animate={maskPosition}
            transition={{ duration: duration ?? 0, ease: "easeOut" }}
          >
            <stop offset="0%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </motion.radialGradient>
          <mask id="textMask">
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="url(#revealMask)"
            />
          </mask>
        </defs>

        <motion.text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          strokeWidth="2"
          className={`${bebas.className} font-bold stroke-neutral-900/30 fill-transparent`}
          fontSize="300"
          initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
          animate={{
            strokeDashoffset: 0,
            strokeDasharray: 1000,
          }}
          transition={{
            duration: 4,
            ease: "easeInOut",
          }}
        >
          {text}
        </motion.text>

        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          stroke="url(#textGradient)"
          strokeWidth="2"
          mask="url(#textMask)"
          fontSize="300"
          className={`${bebas.className} font-bold fill-transparent`}
        >
          {text}
        </text>
      </svg>
    </div>
  );
};
