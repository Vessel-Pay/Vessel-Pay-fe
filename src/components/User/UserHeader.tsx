"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { UserData, fetchUserData, shortenAddress } from './UserData';
import EyeIcon from '@/assets/Eye.svg';

export default function UserHeader() {
  const [user, setUser] = useState<UserData | null>(null);
  const [isBalanceHidden, setIsBalanceHidden] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await fetchUserData();
      setUser(userData);
    };
    loadUser();
  }, []);
  
  if (!user) return null;
  return (
    <div className="flex items-center justify-between mb-6">
      {/* Balance - Left Side */}
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setIsBalanceHidden(!isBalanceHidden)}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <Image 
            src={EyeIcon} 
            alt="Toggle visibility" 
            width={20} 
            height={20}
            className={isBalanceHidden ? 'opacity-50' : ''}
          />
        </button>
        <span className="text-white font-medium">
          {isBalanceHidden ? '••••••' : user.balance.toFixed(4)}
        </span>
        <span className="text-white">{user.currency}</span>
      </div>
      {/* Address - Right Side */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary rounded-full">
        <div className="w-6 h-6 bg-zinc-800 rounded-full flex items-center justify-center">
          <span className="text-xs">👤</span>
        </div>
        <span className="text-black font-medium">{shortenAddress(user.address)}</span>
      </div>
    </div>
  );
}
