"use client";

import { useEffect, useState } from "react";

type TrackingWidgetProps = {
  orderId: string;
};

type TrackingData = {
  status: string;
  lastUpdate: string;
  currentLocation?: string;
  estimatedDelivery?: string;
  message?: string;
  labelUrl?: string;
};

export function TrackingWidget({ orderId }: TrackingWidgetProps) {
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchTracking = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/tracking`);
        if (!response.ok) throw new Error("Failed to fetch tracking");

        const data = await response.json();
        if (isMounted) {
          setTracking(data.tracking);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTracking();

    // Poll every 30 seconds for live updates
    const interval = setInterval(fetchTracking, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId]);

  if (loading) {
    return <div className="animate-pulse h-24 bg-gray-200 rounded" />;
  }

  if (!tracking) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
        Shipment tracking will appear once your order is dispatched.
      </div>
    );
  }

  const statusColor = {
    pending: "gray",
    picked: "blue",
    in_transit: "orange",
    delivered: "green",
    failed: "red",
  }[tracking.status] || "gray";

  const statusLabel = {
    pending: "Pending",
    picked: "Picked Up",
    in_transit: "In Transit",
    delivered: "Delivered",
    failed: "Failed",
  }[tracking.status] || "Unknown";

  return (
    <div className="p-4 border border-gray-200 rounded bg-white">
      <h3 className="font-semibold text-gray-900 mb-4">Order Tracking</h3>

      {error && (
        <div className="mb-4 text-sm text-gray-600">
          Tracking information unavailable right now.
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Status:</span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium text-white bg-${statusColor}-600`}
          >
            {statusLabel}
          </span>
        </div>

        {tracking.currentLocation && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Location:</span>
            <span className="text-sm text-gray-600">{tracking.currentLocation}</span>
          </div>
        )}

        {tracking.estimatedDelivery && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Est. Delivery:</span>
            <span className="text-sm text-gray-600">
              {new Date(tracking.estimatedDelivery).toLocaleDateString()}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Last Updated:</span>
          <span className="text-sm text-gray-600">
            {new Date(tracking.lastUpdate).toLocaleString()}
          </span>
        </div>

        {tracking.message && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">{tracking.message}</p>
          </div>
        )}

        {tracking.labelUrl && (
          <div className="pt-2">
            <a
              href={tracking.labelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              View Shipping Label
            </a>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500 text-center">
        Updates every 30 seconds
      </div>
    </div>
  );
}
