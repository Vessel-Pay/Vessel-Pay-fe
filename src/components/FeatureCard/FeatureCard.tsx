"use client";

import React from "react";
import FeatureCardItem from "./FeatureCardItem";

import swapDefault from "@/assets/swap-default.svg";
import swapHover from "@/assets/swap-hover.svg";
import gaslessDefault from "@/assets/gasless-default.svg";
import gaslessHover from "@/assets/gasless-hover.svg";
import multicoinDefault from "@/assets/multicoin-default.svg";
import multicoinHover from "@/assets/multicoin-hover.svg";
import batchDefault from "@/assets/batch-default.svg";
import batchHover from "@/assets/batch-hover.svg";

const features = [
    {
        title: "Multichain Ready",
        description: "Base Sepolia + Etherlink Shadownet out of the box.",
        imageDefault: "/base.png",
        imageHover: "/etherlink.png",
    },
    {
        title: "Auto-Swap Engine",
        description: "Your tokens, your choice. We handle the conversion.",
        imageDefault: swapDefault.src,
        imageHover: swapHover.src,
    },
    {
        title: "Gasless Transactions",
        description: "Pay gas fees directly with stablecoins. No ETH or XTZ required.",
        imageDefault: gaslessDefault.src,
        imageHover: gaslessHover.src,
    },
    {
        title: "Multicoin Payment",
        description: "Pay with any coins you have. Not just one.",
        imageDefault: multicoinDefault.src,
        imageHover: multicoinHover.src,
    },
    {
        title: "Batch Transfer",
        description: "Send coins to multiple people at the same time.",
        imageDefault: batchDefault.src,
        imageHover: batchHover.src,
    },
];

export default function FeatureCard() {
    return (
        <div className="flex flex-col gap-16 w-full">
            {features.map((feature, index) => (
                <FeatureCardItem
                    key={index}
                    title={feature.title}
                    description={feature.description}
                    imageDefault={feature.imageDefault}
                    imageHover={feature.imageHover}
                />
            ))}
        </div>
    );
}
