import FeatureCard from "./FeatureCard";

export default function FeatureCardMenu() {
    return (
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 bg-black-first py-0">
            {/* Sticky Column */}
            <div className="relative">
                <div className="sticky top-24 lg:top-32 h-fit p-8 sm:p-12 lg:p-16 w-full text-2xl sm:text-3xl lg:text-4xl font-thin text-white text-center">
                    Why choose Vessel Pay?
                </div>
            </div>

            {/* Feature Cards Column */}
            <div className="px-10 py-10 sm:p-12 lg:p-16">
                <FeatureCard />
            </div>
        </div>
    );
}