"use client";
import { useCallback, useMemo } from 'react';
import {
  Send,
  ArrowDownUp,
  ArrowDownLeft,
  RotateCw,
  Coins,
  User,
  LucideIcon,
} from "lucide-react";
import MenuItem from './MenuItem';

export type MenuType =
  | "send"
  | "receive"
  | "swap"
  | "topup"
  | "activity"
  | "profile";
interface MenuProps {
  activeMenu: MenuType;
  onMenuChange: (menu: MenuType) => void;
}
interface MenuItemData {
  id: MenuType;
  label: string;
  Icon: LucideIcon;
}
const menuItemsData: MenuItemData[] = [
  { id: "send", label: "Send", Icon: Send },
  { id: "receive", label: "Receive", Icon: ArrowDownLeft },
  { id: "swap", label: "Swap", Icon: ArrowDownUp },
  { id: "topup", label: "Top Up", Icon: Coins },
  { id: "activity", label: "Activity", Icon: RotateCw },
  { id: "profile", label: "Profile", Icon: User },
];
export default function Menu({ activeMenu, onMenuChange }: MenuProps) {
  const handleMenuClick = useCallback(
    (id: MenuType) => {
      onMenuChange(id);
    },
    [onMenuChange]
  );
  const menuItems = useMemo(
    () =>
      menuItemsData.map((item) => (
        <MenuItem
          key={item.id}
          icon={<item.Icon size={20} />}
          label={item.label}
          isActive={activeMenu === item.id}
          onClick={() => handleMenuClick(item.id)}
        />
      )),
    [activeMenu, handleMenuClick]
  );
  return (
    <div className="w-full">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4 mb-4">
        {menuItems}
      </div>
    </div>
  );
}
