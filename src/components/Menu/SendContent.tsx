"use client"

import { useState, useCallback, useMemo, useEffect } from "react";
import {
    SendMethod,
    MethodType,
    ScanContent,
    InputAddressContent,
} from '@/components/SendMethod';

const contentComponents = {
    scan: ScanContent,
    input_address: InputAddressContent,
}

const STORAGE_KEY = "vessel_active_send_method";

export default function SendContent() {
    const [activeSendMethod, setActiveSencMethod] = useState<MethodType>("scan");
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && ["scan", "input_address"].includes(saved)) {
            setActiveSencMethod(saved as MethodType);
        }
        setIsHydrated(true);
    }, []);

    useEffect(() => {
        if (isHydrated) {
            localStorage.setItem(STORAGE_KEY, activeSendMethod);
        }
    }, [activeSendMethod, isHydrated]);

    const handleMethodChange = useCallback((method: MethodType) => {
        setActiveSencMethod(method);
    }, []);

    const ActiveContent = useMemo(
        () => contentComponents[activeSendMethod],
        [activeSendMethod]
    );

    if (!isHydrated) {
        return (
            <div>
                { }
            </div>
        )
    }
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center justify-center">
                <SendMethod activeMethod={activeSendMethod} onMethodChange={handleMethodChange} />
            </div>
            <div>
                <ActiveContent />
            </div>
        </div>
    );
}