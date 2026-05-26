// src/components/buyer/ShipmentTracker.tsx
"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Circle, Loader2, AlertCircle } from "lucide-react";

interface TrackingInfo {
  status: string;
  lastUpdate: string;
  currentLocation?: string;
  estimatedDelivery?: string;
  message?: string;
}

interface ShipmentTrackerProps {
  orderId: string;
  trackingCode?: string;
}

export function ShipmentTracker({ orderId, trackingCode }: ShipmentTrackerProps) {
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const timeline = [
    { status: "pending", label: "Order Confirmed" },
    { status: "picked", label: "Picked Up" },
    { status: "in_transit", label: "In Transit" },
    { status: "out_for_delivery", label: "Out for Delivery" },
    { status: "delivered", label: "Delivered" },
  ];

  async function fetchTracking() {
    if (!trackingCode) {
      setError("No tracking code available yet");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/logistics/track/${trackingCode}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("No shipment found for this tracking code");
        } else {
          throw new Error("Failed to fetch tracking");
        }
        setIsLoading(false);
        return;
      }

      const resData = await response.json();
      if (resData.ok && resData.updates && resData.updates.length > 0) {
        const latest = resData.updates[resData.updates.length - 1];
        setTracking({
          status: latest.status || resData.status?.toLowerCase() || "pending",
          lastUpdate: latest.lastUpdate || resData.lastSyncedAt || new Date().toISOString(),
          currentLocation: latest.currentLocation || "",
          estimatedDelivery: latest.estimatedDelivery || resData.estimatedDelivery || "",
          message: latest.message || "",
        });
      } else {
        setTracking({
          status: resData.status?.toLowerCase() || "pending",
          lastUpdate: resData.lastSyncedAt || new Date().toISOString(),
          message: "No tracking details reported yet.",
        });
      }
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tracking");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTracking();

    // Refresh every 5 minutes
    const interval = setInterval(fetchTracking, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [orderId, trackingCode]);

  if (isLoading && !tracking) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return null;
  }

  const statusIndex = timeline.findIndex((s) => s.status === tracking.status);
  const isDelivered = tracking.status === "delivered";
  const isFailed = tracking.status === "failed";

  const lastUpdateDate = new Date(tracking.lastUpdate);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - lastUpdateDate.getTime()) / (1000 * 60));

  let timeAgo = "just now";
  if (diffMinutes > 60) {
    timeAgo = `${Math.floor(diffMinutes / 60)} hours ago`;
  } else if (diffMinutes > 0) {
    timeAgo = `${diffMinutes} minutes ago`;
  }

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className={`rounded-lg border-2 p-4 ${
        isDelivered
          ? "border-green-200 bg-green-50"
          : isFailed
            ? "border-red-200 bg-red-50"
            : "border-blue-200 bg-blue-50"
      }`}>
        <p className="text-sm font-medium text-gray-600">Current Status</p>
        <p className={`text-2xl font-bold ${
          isDelivered
            ? "text-green-900"
            : isFailed
              ? "text-red-900"
              : "text-blue-900"
        }`}>
          {tracking.status.replace(/_/g, " ").toUpperCase()}
        </p>
        {tracking.currentLocation && (
          <p className="mt-2 text-sm text-gray-700">{tracking.currentLocation}</p>
        )}
        <p className="mt-1 text-xs text-gray-600">Updated {timeAgo}</p>
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-gray-900">Delivery Timeline</p>
        <div className="space-y-4">
          {timeline.map((step, idx) => {
            const isActive = statusIndex >= idx;
            const isCurrent = statusIndex === idx;

            return (
              <div key={step.status} className="flex gap-4">
                <div className="flex flex-col items-center">
                  {isActive ? (
                    <CheckCircle
                      className={`h-6 w-6 ${
                        isCurrent ? "text-blue-600" : "text-green-600"
                      }`}
                    />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-300" />
                  )}
                  {idx < timeline.length - 1 && (
                    <div
                      className={`my-1 h-8 w-0.5 ${
                        isActive ? "bg-green-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
                <div className="pb-4">
                  <p
                    className={`font-medium ${
                      isActive ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Estimated Delivery */}
      {tracking.estimatedDelivery && !isDelivered && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-600">Estimated Delivery</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {new Date(tracking.estimatedDelivery).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      )}

      {/* Message */}
      {tracking.message && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-700">{tracking.message}</p>
        </div>
      )}

      {/* Tracking Code */}
      {trackingCode && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase text-gray-600">Tracking Code</p>
          <p className="mt-1 font-mono text-sm font-semibold text-gray-900">
            {trackingCode}
          </p>
        </div>
      )}

      {/* Refresh */}
      <button
        onClick={fetchTracking}
        disabled={isLoading}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          <>Refresh Status</>
        )}
      </button>

      {lastRefresh && (
        <p className="text-center text-xs text-gray-500">
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
