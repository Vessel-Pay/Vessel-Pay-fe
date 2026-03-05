"use client";

import HowItWorksCardItem from "./HowItWorksCardItem";

import SendFeature1 from '@/assets/send-1.png';
import SendFeature2 from '@/assets/send-2.png';
import SendFeature3 from '@/assets/send-3.png';
import SendFeature4 from '@/assets/send-4.png';
import ReceiveFeature from '@/assets/receive-1.png';
import ReceiveFeature2 from '@/assets/receive-2.png';
import SwapFeature from '@/assets/swap.png';
import TopUpFeature from '@/assets/top-up.png';

const howItWorks = [
    {
        images: [SendFeature1.src, SendFeature2.src, SendFeature3.src, SendFeature4.src],
        title: "Send",
        description: "Send token to anyone with any token instantly through your lens.",
        steps: [
            "Scan or input into addresses",
            "Choose your payment method",
            "Hit Pay Now button"
        ]
    },
    {
        images: [ReceiveFeature.src, ReceiveFeature2.src],
        title: "Receive",
        description: "Set the amount and generate QR Code to receive token from anyone with any token.",
    },
    {
        images: [SwapFeature.src],
        title: "Swap",
        description: "Set the amount and choose which stablecoin currency you want to convert your token into.",
    },
    {
        images: [TopUpFeature.src],
        title: "Top Up",
        description: "Set the amount and choose which stablecoin currency you want to convert your token into.",
    }
];

export default function HowItWorksCard() {
    return (
        <div className="w-full h-auto flex flex-col gap-20">
            {howItWorks.map((item, index) => (
                <HowItWorksCardItem
                    key={index}
                    images={'images' in item ? item.images : undefined}
                    title={item.title}
                    description={item.description}
                    steps={item.steps}
                    isReversed={index % 2 !== 0}
                />
            ))}
        </div>
    )
}