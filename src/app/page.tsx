"use client";

import { useRef, useLayoutEffect, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { StaggeredMenu } from '@/components/StaggeredMenu';
import { FeatureCards } from '@/components/FeatureCards';
import TechStack from '@/components/TechStack/TechStack';
import { Footer } from '@/components/Footer';
import { AnimatedHero } from '@/components/Hero';
import { sdk } from '@farcaster/miniapp-sdk';
import { FeatureCardMenu } from '@/components/FeatureCard';
import { HowItWorksSection } from '@/components/HowItWorks';
import { SupportedCoinsMarquee } from '@/components/Marquee/Marquee';

// Register ScrollTrigger plugin
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const menuItems = [
  { label: 'Get Started', ariaLabel: 'Get Started', link: '/app' },
  { label: 'Docs', ariaLabel: 'View our documentation', link: 'https://github.com/Vessel-Pay' },
];

const socialItems = [
  { label: 'Github', link: 'https://github.com/Vessel-Pay' },
  { label: 'X', link: 'https://x.com/Deepesh_tsx' },
  { label: 'Instagram', link: 'https://www.instagram.com/deepesh.kkk/' },
  { label: 'Discord', link: 'https://discord.com' }
];

export default function Home() {
  const footerContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Apply scroll snap to document body for Lenis window scroll
    document.documentElement.style.scrollSnapType = 'y proximity';
    document.documentElement.style.scrollBehavior = 'smooth';

    return () => {
      document.documentElement.style.scrollSnapType = '';
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  useEffect(() => {
    sdk.actions.ready();
  }, []);


  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const footerEl = footerContainerRef.current;
      if (!footerEl) return;

      ScrollTrigger.create({
        trigger: footerEl,
        start: 'top 60%',
        end: 'bottom top',
        invalidateOnRefresh: true,

        onEnter: () => {
          gsap.to(footerEl, {
            backgroundColor: '#D89B00',
            duration: 0.5,
            ease: 'power2.out',
            overwrite: 'auto'
          });
        },
        onLeaveBack: () => {
          gsap.to(footerEl, {
            backgroundColor: '#000000',
            duration: 0.5,
            ease: 'power2.out',
            overwrite: 'auto'
          });
        },
        onEnterBack: () => {
          gsap.to(footerEl, {
            backgroundColor: '#D89B00',
            duration: 0.5,
            ease: 'power2.out',
            overwrite: 'auto'
          });
        }
      });
    }, footerContainerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className='min-h-screen bg-black-first overflow-x-hidden'>
      <StaggeredMenu
        isFixed={true}
        position="right"
        items={menuItems}
        socialItems={socialItems}
        displaySocials={true}
        displayItemNumbering={false}
        menuButtonColor="#fff"
        openMenuButtonColor="#fff"
        changeMenuColorOnOpen={false}
        colors={['#D89B00', '#E1C300']}
        logoUrl="/logo.svg"
        accentColor="#E1C300"
        onMenuOpen={() => console.log('Menu opened')}
        onMenuClose={() => console.log('Menu closed')}
      />

      {/* Hero Section */}
      <AnimatedHero />

      <div className="py-16 md:py-32">
        <FeatureCardMenu />
      </div>

      <div className="py-16 md:py-32">
        <HowItWorksSection />
      </div>

      {/* Supported Coins Marquee Section */}
      <SupportedCoinsMarquee />

      <div className="py-16 md:py-32">
        <TechStack />
      </div>

      {/* Footer Section */}
      <div
        ref={footerContainerRef}
        className="min-h-screen w-full relative footer-bg-dynamic"
        style={{
          backgroundColor: '#1A1A1A',
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always'
        }}
      >
        <Footer />
      </div>
    </div>
  );
}
