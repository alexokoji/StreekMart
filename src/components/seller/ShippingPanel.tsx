"use client";

import { useState } from "react";

type ShippingPanelProps = {
  orderId: string;
  orderStatus: string;
  onSuccess?: () => void;
};

export function ShippingPanel({ orderId, orderStatus, onSuccess }: ShippingPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [shipmentData, setShipmentData] = useState<any>(null);

  const [formData, setFormData] = useState({
    weight: "1",
    length: "",
    width: "",
    height: "",
    specialHandling: "",
  });

  const canCreateShipment = orderStatus === "PAID" || orderStatus === "SHIPPED";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload: any = {
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        specialHandling: formData.specialHandling || undefined,
      };

      if (formData.length && formData.width && formData.height) {
        payload.dimensions = {
          length: parseFloat(formData.length),
          width: parseFloat(formData.width),
          height: parseFloat(formData.height),
        };
      }

      const response = await fetch(`/api/orders/${orderId}/shipping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create shipment");
      }

      const result = await response.json();
      setShipmentData(result.shipment);
      setSuccess(true);
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  if (!canCreateShipment) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">
          Shipment can only be created after payment is confirmed.
        </p>
      </div>
    );
  }

  if (success && shipmentData) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded">
        <h3 className="font-semibold text-green-900 mb-2">Shipment Created</h3>
        <div className="space-y-2 text-sm text-green-800">
          <p>
            <strong>Tracking Code:</strong> {shipmentData.trackingCode}
          </p>
          {shipmentData.labelUrl && (
            <p>
              <a
                href={shipmentData.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 underline hover:text-green-800"
              >
                Download Shipping Label
              </a>
            </p>
          )}
          {shipmentData.receiptUrl && (
            <p>
              <a
                href={shipmentData.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 underline hover:text-green-800"
              >
                Download Receipt
              </a>
            </p>
          )}
        </div>
        <button
          onClick={() => {
            setSuccess(false);
            setShipmentData(null);
          }}
          className="mt-4 text-sm text-green-600 hover:text-green-800 underline"
        >
          Create another shipment
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded bg-white">
      <h3 className="font-semibold mb-4">Create Shipment</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Weight (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Length (cm)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.length}
              onChange={(e) => setFormData({ ...formData, length: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Width (cm)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.width}
              onChange={(e) => setFormData({ ...formData, width: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Height (cm)
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.height}
              onChange={(e) => setFormData({ ...formData, height: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Special Handling (optional)
          </label>
          <input
            type="text"
            placeholder="e.g., Fragile, Handle with care"
            value={formData.specialHandling}
            onChange={(e) => setFormData({ ...formData, specialHandling: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
        >
          {isLoading ? "Creating shipment..." : "Create Shipment"}
        </button>
      </form>
    </div>
  );
}
