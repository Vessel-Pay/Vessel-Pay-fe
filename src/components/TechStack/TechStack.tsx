'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface TechItem {
    name: string;
    icon: string;
}

const techStack: TechItem[] = [
    { name: 'Etherlink', icon: '/icons/Etherlink.svg' },
    { name: 'Pimlico', icon: '/icons/pimlico.svg' },
    { name: 'Base', icon: '/icons/Base.svg' },
    { name: 'IDRX API', icon: '/icons/IDRX-2.svg' },
    { name: 'QRIS', icon: '/icons/QRIS.svg' },
    { name: 'Privy', icon: '/icons/Privy.svg' },
];

const containerVariants = {
    initial: { opacity: 0, scale: 0.8 },
    animate: (index: number) => ({
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.5,
            delay: index * 0.1,
            ease: 'easeOut',
        },
    }),
};

const backgroundSlideVariants = {
    initial: {
        scaleX: 0,
    },
    animate: {
        scaleX: 0,
    },
    hover: {
        scaleX: 1,
        transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number]
        }
    }
};

const iconVariants = {
    initial: { scale: 1 },
    hover: {
        scale: 1.1,
        transition: { duration: 0.3 }
    }
};

const textVariants = {
    initial: { opacity: 0.5, color: '#ffffff', fontWeight: 100, y: 0 },
    animate: { opacity: 0.5, color: '#ffffff', fontWeight: 100, y: 0 },
    hover: {
        opacity: 1,
        color: '#000000',
        fontWeight: 400,
        y: 0,
        transition: { duration: 0.3 }
    }
};

export default function TechStack() {
    return (
        <section
            className="w-full bg-black-first flex flex-col items-center justify-center px-4 py-0"
            style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
        >
            <h1 className="text-xl md:text-3xl lg:text-4xl font-thin mb-8 md:mb-16 text-center tracking-wider font-hero text-white">
                Integrated With
            </h1>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-0 max-w-5xl w-full">
                {techStack.map((tech, index) => {
                    const isNotLastInRow = (index + 1) % 3 !== 0;
                    const isNotLastRow = index < 3;

                    return (
                        <motion.div
                            key={tech.name}
                            // variants={containerVariants}
                            initial="initial"
                            animate="animate"
                            whileHover="hover"
                            custom={index}
                            className={`
                                group relative aspect-square flex flex-col items-center justify-center cursor-pointer overflow-hidden
                                
                            `}
                        >
                            {/* Sliding background effect */}
                            <motion.div
                                variants={backgroundSlideVariants}
                                className="absolute inset-0 origin-left"
                                style={{ transformOrigin: 'left', backgroundColor: '#D89B00' }}
                            />

                            {/* Icon container */}
                            <motion.div
                                variants={iconVariants}
                                className="relative z-10 w-16 h-16 md:w-24 md:h-24 lg:w-32 lg:h-32"
                            >
                                <Image
                                    src={tech.icon}
                                    alt={tech.name}
                                    fill
                                    className="object-contain p-2 md:p-4 transition-all duration-300"
                                    sizes="(max-width: 768px) 50vw, 33vw"
                                />
                            </motion.div>

                            {/* Label that appears on hover */}
                            <motion.span
                                variants={textVariants}
                                className="relative z-10 font-hero text-xs md:text-base lg:text-lg mt-1 md:mt-2 whitespace-nowrap"
                            >
                                {tech.name}
                            </motion.span>
                        </motion.div>
                    );
                })}
            </div>
        </section>
    );
}
