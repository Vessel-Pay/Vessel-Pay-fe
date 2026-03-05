import { MarqueeItem } from "./MarqueeItem";
import CoinMarqueeCard from "./CoinMarqueeCard";

// Data untuk supported coins
const supportedCoins = [
    { icon: "/icons/idrx.svg", name: "IDRX" },
    { icon: "/icons/usdc.svg", name: "USDC" },
    { icon: "/icons/usdt.svg", name: "USDT" },
    { icon: "/icons/sky-dollar.svg", name: "USDS" },
    { icon: "/icons/eurc.svg", name: "EURC" },
    { icon: "/icons/cad.svg", name: "CADC" },
    { icon: "/icons/audd.svg", name: "AUDD" },
    { icon: "/icons/brazillian.svg", name: "BRZ" },
    { icon: "/icons/frankencoin.svg", name: "ZCHF" },
    { icon: "/icons/tokenised.svg", name: "TGBP" },
];

export function SupportedCoinsMarquee() {
    return (
        <div className="w-full h-auto flex justify-center py-16 md:py-32 overflow-x-hidden">
            <div className="w-full max-w-7xl flex flex-col items-center gap-12 overflow-x-hidden">
                {/* Title Section */}
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-thin text-white text-center">
                    Supported Coins
                </h2>

                {/* Marquee Section */}
                <MarqueeItem pauseOnHover className="[--duration:30s]">
                    {supportedCoins.map((coin, index) => (
                        <CoinMarqueeCard
                            key={index}
                            icon={coin.icon}
                            name={coin.name}
                        />
                    ))}
                </MarqueeItem>
            </div>
        </div>
    );
}
