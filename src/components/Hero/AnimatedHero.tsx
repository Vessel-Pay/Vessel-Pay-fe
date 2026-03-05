"use client";

import { useRef, useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Iridescent } from "@/components/Iridescent";
import Link from "next/link";

// Register ScrollTrigger
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Store original text outside component to prevent loss on re-renders
const ORIGINAL_TITLE = "Gasless Payment\nfor Everyone";
const ORIGINAL_DESC = "Any Stablecoin. Anywhere. Gasless.";

export default function AnimatedHero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const rightColumnRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Reset to original text first to ensure clean state
    if (titleRef.current) {
      titleRef.current.innerHTML = ORIGINAL_TITLE.split("\n").join("<br/>");
    }
    if (descRef.current) {
      descRef.current.textContent = ORIGINAL_DESC;
    }

    const ctx = gsap.context(() => {
      // Split text into characters, but wrap each word to prevent mid-word breaks
      if (titleRef.current) {
        const text = ORIGINAL_TITLE;
        // Split by lines first, then words, then characters
        titleRef.current.innerHTML = text
          .split("\n")
          .map((line) => {
            return line
              .split(" ")
              .map((word) => {
                const chars = word
                  .split("")
                  .map(
                    (char, i) =>
                      `<span class="inline-block char" style="opacity: 0; color: #D89B00;">${char}</span>`
                  )
                  .join("");
                // Wrap each word in a container that prevents breaking
                return `<span class="inline-flex" style="white-space: nowrap;">${chars}</span>`;
              })
              .join(
                '<span class="inline-block" style="width: 0.3em;">&nbsp;</span>'
              );
          })
          .join("<br/>");

        // Show title container now that chars are set up with opacity: 0
        gsap.set(titleRef.current, { opacity: 1 });

        const chars = titleRef.current.querySelectorAll("span.char");

        // Simple reveal animation
        gsap.fromTo(
          chars,
          {
            opacity: 0,
            y: 50,
            rotateX: -90,
          },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.8,
            stagger: {
              each: 0.03,
              from: "start",
            },
            ease: "back.out(1.7)",
          }
        );

        // Add shimmer effect to individual chars
        chars.forEach((char) => {
          gsap.to(char, {
            color: "#FACC15",
            duration: 1.5,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: Math.random() * 2,
          });
        });
      }

      // Description fade in with stagger
      if (descRef.current) {
        const text = ORIGINAL_DESC;
        descRef.current.innerHTML = text
          .split(/(\s+)/)
          .map((part) => {
            if (part === "\n") return "<br/>";
            if (/\s+/.test(part))
              return `<span class="inline-block" style="width: 0.3em;">&nbsp;</span>`;
            return `<span class="inline-block mr-[0.3em]">${part}</span>`;
          })
          .join("");

        // Show desc container now that spans are set up
        gsap.set(descRef.current, { opacity: 1 });

        gsap.fromTo(
          descRef.current.querySelectorAll("span"),
          {
            opacity: 0,
            y: 20,
            filter: "blur(10px)",
          },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            duration: 0.6,
            stagger: 0.05,
            delay: 1,
            ease: "power2.out",
          }
        );
      }

      // Button magnetic effect and entrance
      if (buttonRef.current) {
        gsap.fromTo(
          buttonRef.current,
          {
            opacity: 0,
            scale: 0.5,
            y: 30,
          },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 0.8,
            delay: 1.5,
            ease: "elastic.out(1, 0.5)",
          }
        );

        // Magnetic hover effect
        const button = buttonRef.current;
        const handleMouseMove = (e: MouseEvent) => {
          const rect = button.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;

          gsap.to(button, {
            x: x * 0.3,
            y: y * 0.3,
            duration: 0.3,
            ease: "power2.out",
          });
        };

        const handleMouseLeave = () => {
          gsap.to(button, {
            x: 0,
            y: 0,
            duration: 0.5,
            ease: "elastic.out(1, 0.5)",
          });
        };

        button.addEventListener("mousemove", handleMouseMove);
        button.addEventListener("mouseleave", handleMouseLeave);
      }

      // Scroll transition animation - black column expands, iridescent shrinks
      if (leftColumnRef.current && rightColumnRef.current && heroRef.current) {
        gsap.to(leftColumnRef.current, {
          width: "100%",
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: heroRef.current,
            start: "bottom bottom",
            end: "bottom top",
            scrub: 1,
          },
        });

        gsap.to(rightColumnRef.current, {
          width: "0%",
          opacity: 0,
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: heroRef.current,
            start: "bottom bottom",
            end: "bottom top",
            scrub: 1,
          },
        });
      }
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      className="flex flex-col md:flex-row min-h-screen relative overflow-hidden"
      style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
    >
      {/* Left Column - Hero Text (Black Container) */}
      <div
        ref={leftColumnRef}
        className="w-full md:w-1/2 min-h-[60vh] md:min-h-screen flex flex-col justify-center items-start px-4 sm:px-8 md:px-16 pt-20 pb-12 md:py-0 relative bg-black-first z-10"
      >
        <h1
          ref={titleRef}
          className="text-[2rem] sm:text-4xl md:text-5xl lg:text-6xl font-hero font-medium mb-4"
          style={{
            perspective: "1000px",
            transformStyle: "preserve-3d",
            opacity: 0,
          }}
        >
          Gasless Payment <br />
          for Everyone
        </h1>

        <p
          ref={descRef}
          className="text-xs sm:text-sm md:text-base lg:text-lg text-white mb-6 md:mb-8 text-left font-thin max-w-xl opacity-0"
        >
          Any Stablecoin. Anywhere. Gasless.
        </p>

        <Link
          href="/app"
          ref={buttonRef}
          className="relative px-6 sm:px-8 py-3 sm:py-4 border-2 border-primary text-white font-hero font-thin text-xs sm:text-sm md:text-base overflow-hidden group inline-block"
          style={{
            background: "transparent",
            transition: "all 0.3s ease",
            opacity: 0,
          }}
          onMouseEnter={(e) => {
            gsap.to(e.currentTarget.querySelector(".btn-bg"), {
              scaleX: 1,
              duration: 0.4,
              ease: "power2.out",
            });
          }}
          onMouseLeave={(e) => {
            gsap.to(e.currentTarget.querySelector(".btn-bg"), {
              scaleX: 0,
              duration: 0.4,
              ease: "power2.out",
            });
          }}
        >
          <span
            className="btn-bg absolute inset-0 bg-primary origin-left"
            style={{ transform: "scaleX(0)" }}
          />
          <span className="relative z-10 group-hover:text-black transition-colors duration-300 font-medium">
            Get Started
          </span>
        </Link>
      </div>

      {/* Right Column - Iridescent (Yellow/Orange Container) */}
      <div
        ref={rightColumnRef}
        className="w-full md:w-1/2 h-[200px] md:min-h-screen relative overflow-hidden flex justify-center"
      >
        <div className="w-full h-full relative">
          <Iridescent color={[1, 0.6, 0.2]} mouseReact={false} />
        </div>
      </div>
    </section>
  );
}
