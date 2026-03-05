'use client';

import { ArrowUpRight } from 'lucide-react';
import { TextHoverEffect } from './TextHoverEffect';

interface FooterLink {
    label: string;
    href: string;
    external?: boolean;
}

interface FooterSection {
    title: string;
    links: FooterLink[];
}

const footerSections: FooterSection[] = [
    {
        title: 'Resource',
        links: [
            { label: 'Documentation', href: 'https://github.com/Vessel-Pay', external: true },
            { label: 'Github', href: 'https://github.com/Vessel-Pay', external: true },
            { label: 'Terms and Conditions', href: '/terms', external: false },
            { label: 'Privacy Policy', href: '/privacy', external: false },
        ],
    },
    {
        title: 'Community',
        links: [
            { label: 'X', href: 'https://x.com/Deepesh_tsx', external: true },
            { label: 'Discord', href: 'https://discord.com', external: true },
            { label: 'Instagram', href: 'https://www.instagram.com/deepesh.kkk/', external: true },
        ],
    },
];

export default function Footer() {
    return (
        <footer className="w-full py-16 px-6 md:px-12 lg:px-20">
            <div className="relative max-w-6xl mx-auto p-8 md:p-8 lg:p-12">
                <div className="flex flex-col md:flex-row justify-end gap-16 md:gap-24 lg:gap-32">
                    {footerSections.map((section) => (
                        <div key={section.title} className="flex flex-col gap-4">
                            <h3
                                className="font-hero text-xl md:text-2xl text-black font-semibold tracking-wide"
                                style={{ fontVariant: 'small-caps' }}
                            >
                                {section.title}
                            </h3>
                            <ul className="flex flex-col gap-2">
                                {section.links.map((link) => (
                                    <li key={link.label}>
                                        <a
                                            href={link.href}
                                            target={link.external ? '_blank' : undefined}
                                            rel={link.external ? 'noopener noreferrer' : undefined}
                                            className="font-sans text-sm md:text-base text-black hover:text-white transition-opacity inline-flex items-center gap-1 font-normal"
                                        >
                                            {link.label}
                                            {link.external && (
                                                <ArrowUpRight className="w-4 h-4" strokeWidth={2} />
                                            )}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
            <div className='w-full '>
                <TextHoverEffect text="VESSEL PAY" />
            </div>
        </footer>
    );
}
