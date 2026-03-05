import Image from 'next/image';
import { Send, ArrowDownLeft, ArrowUpDown } from 'lucide-react';
import { ActivityData } from './types';
import { formatActivityDate, formatActivityTime } from './GetActivityHistory';

interface ActivityItemProps {
  activity: ActivityData;
}

export default function ActivityItem({ activity }: ActivityItemProps) {
  // Get icon based on activity type
  const getIcon = () => {
    const iconClass = "text-primary";
    switch (activity.type) {
      case 'send':
        return <Send size={20} className={iconClass} />;
      case 'receive':
        return <ArrowDownLeft size={20} className={iconClass} />;
      case 'swap':
        return <ArrowUpDown size={20} className={iconClass} />;
    }
  };
  // Get label based on activity type
  const getLabel = () => {
    switch (activity.type) {
      case 'send':
        return 'Sent';
      case 'receive':
        return 'Receive';
      case 'swap':
        return 'Swap';
    }
  };
  // Get status color
  const getStatusColor = () => {
    switch (activity.status) {
      case 'confirmed':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'canceled':
        return 'text-red-500';
    }
  };
  // Format amount with sign
  const formatAmount = () => {
    const sign = activity.type === 'send' ? '-' : activity.type === 'receive' ? '+' : '';
    return `${sign}${activity.amount} ${activity.currency}`;
  };
  return (
    <div className="flex items-center gap-3 sm:gap-4 py-3 sm:py-4">
      {/* Icon */}
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
        {getIcon()}
      </div>
      {/* Activity Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{getLabel()}</span>
        </div>
        <span className={`text-sm capitalize ${getStatusColor()}`}>
          {activity.status}
        </span>
        <div className="text-zinc-500 text-sm">
          {formatActivityDate(activity.timestamp)} • {formatActivityTime(activity.timestamp)}
        </div>
      </div>
      {/* Amount */}
      <div className="text-right">
        <div className="text-white font-medium">
          {formatAmount()}
        </div>
        {/* For swap, show converted amount */}
        {activity.type === 'swap' && activity.swapToAmount && (
          <div className="text-zinc-400 text-sm">
            {activity.swapToAmount} {activity.swapToCurrency}
          </div>
        )}
      </div>
    </div>
  );
}
