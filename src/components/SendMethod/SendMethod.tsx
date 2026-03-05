"use client";

import { useCallback, useMemo } from 'react';
import SendMethodItem from './SendMethodItem';

export type MethodType = "scan" | "input_address";

interface MethodProps {
    activeMethod: MethodType;
    onMethodChange: (method: MethodType) => void;
}

interface MethodItemData {
    id: MethodType;
    label: string;
}

const methodItemsData: MethodItemData[] = [
    { id: "scan", label: "Scan" },
    { id: "input_address", label: "Input Address" },
];

export default function SendMethod({ activeMethod, onMethodChange }: MethodProps) {
    const handleMethodClick = useCallback(
        (id: MethodType) => {
            onMethodChange(id);
        }, [onMethodChange]
    );

    const methodItems = useMemo(
        () => methodItemsData.map((item) => (
            <SendMethodItem
                key={item.id}
                label={item.label}
                isActive={activeMethod === item.id}
                onClick={() => handleMethodClick(item.id)}
            />
        )),
        [activeMethod, handleMethodClick]
    );
    return (
        <div className='w-full sm:w-3/4 shadow-[inset_0_0_0_1px_rgba(105,105,105,1)] rounded-full'>
            <div className='flex justify-center items-center'>{methodItems}</div>
        </div>
    )
}