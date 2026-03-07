"use client";
export const dynamic = "force-dynamic";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Menu,
  MenuType,
  SendContent,
  ReceiveContent,
  SwapContent,
  TopUpContent,
  ActivityContent,
  ProfileContent,
} from "@/components/Menu";
import {
  WalletButton,
  ChainSelector,
  BalanceDisplay,
  FaucetButton,
} from "@/components/Wallet";
import { useSmartAccount } from "@/hooks/useSmartAccount";

const contentComponents = {
  send: SendContent,
  receive: ReceiveContent,
  swap: SwapContent,
  topup: TopUpContent,
  activity: ActivityContent,
  profile: ProfileContent,
};
const STORAGE_KEY = "vessel_active_menu";

export default function Start() {
  const [activeMenu, setActiveMenu] = useState<MenuType>("send");
  const [isHydrated, setIsHydrated] = useState(false);

  useSmartAccount(); // Initialize smart account automatically

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (
      saved &&
      ["send", "receive", "swap", "topup", "activity", "profile"].includes(saved)
    ) {
      setActiveMenu(saved as MenuType);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, activeMenu);
    }
  }, [activeMenu, isHydrated]);

  const handleMenuChange = useCallback((menu: MenuType) => {
    setActiveMenu(menu);
  }, []);

  const ActiveContent = useMemo(
    () => contentComponents[activeMenu],
    [activeMenu],
  );

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-black-primary p-8">
        <div className="max-w-2xl mx-auto space-y-8">{/* Skeleton */}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black-secondary p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header with Logo and Wallet */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Logo - bigger */}
          <img src="/logo.svg" alt="Vessel Pay" className="h-25 sm:h-31 shrink-0" />

          {/* Wallet Info - Address + Balance */}
          <div className="flex flex-col items-end gap-2 w-full sm:w-auto self-end">
            <div className="flex items-center gap-2 flex-wrap justify-end w-full sm:w-auto">
              <ChainSelector />
              <WalletButton />
            </div>
            <BalanceDisplay />
            <FaucetButton />
          </div>
        </div>

        <div className="bg-black-primary rounded-2xl">
          <div className="p-4">
            <Menu activeMenu={activeMenu} onMenuChange={handleMenuChange} />
            <ActiveContent />
          </div>
        </div>
      </div>
    </div>
  );
}
