"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import ActivityItem from "./ActivityItem";
import { ActivityData, GroupedActivities } from "./types";
import {
  fetchActivityHistory,
  groupActivitiesByPeriod,
} from "./GetActivityHistory";
import { useSmartAccount } from "@/hooks/useSmartAccount";
import { useActiveChain } from "@/hooks/useActiveChain";
import Modal from "@/components/Modal";

export default function Activity() {
  const [groupedActivities, setGroupedActivities] = useState<
    GroupedActivities[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Error modal state
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onRetry?: () => void;
  }>({ isOpen: false, title: "", message: "" });

  const { smartAccountAddress, isReady } = useSmartAccount();
  const { config } = useActiveChain();

  const loadActivities = useCallback(async () => {
    if (!smartAccountAddress) {
      setGroupedActivities([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const activities = await fetchActivityHistory(
        smartAccountAddress,
        config
      );
      const grouped = groupActivitiesByPeriod(activities);
      setGroupedActivities(grouped);
    } catch (err) {
      console.error("Failed to load activities:", err);
      setError("Failed to load activity history");
      setErrorModal({
        isOpen: true,
        title: "Activity Error",
        message: err instanceof Error ? err.message : "Failed to load activity history",
        onRetry: loadActivities,
      });
    } finally {
      setIsLoading(false);
    }
  }, [smartAccountAddress, config]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  // Show connect wallet message if not connected
  if (isReady && !smartAccountAddress) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">Connect wallet to view activity</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-zinc-400">Loading activities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-red-400">{error}</p>
        <button
          onClick={loadActivities}
          className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (groupedActivities.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={loadActivities}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {groupedActivities.map((group) => (
        <div key={group.label}>
          {/* Period Label */}
          <h3 className="text-zinc-400 text-sm font-medium mb-2">
            {group.label}
          </h3>

          {/* Activity Items */}
          <div className="divide-y divide-zinc-800">
            {group.activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      ))}

      {/* Error Modal */}
      <Modal
        id="activity-error-modal"
        className="modal-alert"
        role="alertdialog"
        aria-modal={true}
        aria-labelledby="alert-title"
        aria-describedby="alert-desc"
        tabIndex={-1}
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
        title={errorModal.title}
        message={errorModal.message}
      >
        {errorModal.onRetry && (
          <button
            onClick={() => {
              errorModal.onRetry?.();
              setErrorModal({ ...errorModal, isOpen: false });
            }}
            className="w-full py-4 bg-primary text-black font-bold text-lg rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
          >
            RETRY
          </button>
        )}
      </Modal>
    </div>
  );
}
