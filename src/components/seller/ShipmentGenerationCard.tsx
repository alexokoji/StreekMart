// src/components/seller/ShipmentGenerationCard.tsx
"use client";

import { useState } from "react";
import { Truck, FileText, Package } from "lucide-react";

export interface OrderWithShipment {
  id: string;
  productId: string;
  quantity: number;
  totalPrice: number;
  status: string;
  shippingAddress?: string;
  buyer: {
    name: string;
    phone?: string;
    city?: string;
  };
  product: {
    name: string;
  };
  shipment?: {
    id: string;
    trackingCode: string;
    status: string;
    labelUrl?: string;
  };
}

interface ShipmentGenerationCardProps {
  order: OrderWithShipment;
  onShipmentCreated?: () => void;
}

export function ShipmentGenerationCard({ order, onShipmentCreated }: ShipmentGenerationCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCourierSelect, setShowCourierSelect] = useState(false);

  const couriers = [
    { id: "economy", name: "Economy", description: "5 days", price: "$15" },
    { id: "standard", name: "Standard", description: "3 days", price: "$25" },
    { id: "express", name: "Express", description: "1 day", price: "$50" },
  ];

  async function handleCreateShipment(courierId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/logistics/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          provider: "SENDBOX",
          courierCode: courierId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create shipment");
      }

      const { shipment } = await response.json();
      onShipmentCreated?.();

      // Auto-download or show label
      if (shipment.labelUrl) {
        window.open(shipment.labelUrl, "_blank");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create shipment");
    } finally {
      setIsLoading(false);
      setShowCourierSelect(false);
    }
  }

  const hasShipment = !!order.shipment;
  const statusColors: Record<string, string> = {
    PENDING: "bg-yellow-50 border-yellow-200",
    PICKED: "bg-blue-50 border-blue-200",
    IN_TRANSIT: "bg-blue-100 border-blue-300",
    OUT_FOR_DELIVERY: "bg-orange-50 border-orange-200",
    DELIVERED: "bg-green-50 border-green-200",
    FAILED: "bg-red-50 border-red-200",
  };

  return (
    <div className={`rounded-lg border p-4 ${hasShipment ? statusColors[order.shipment!.status] : "bg-white border-gray-200"}`}>
      {/* Order Summary */}
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-gray-900">Order #{order.id.slice(0, 8)}</p>
            <p className="text-sm text-gray-600">{order.product.name}</p>
            <p className="text-sm text-gray-600">Qty: {order.quantity}</p>
          </div>
          <span className={`inline-block rounded px-3 py-1 text-xs font-medium ${
            hasShipment
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-800"
          }`}>
            {hasShipment ? order.shipment!.status : "No Shipment"}
          </span>
        </div>
      </div>

      {/* Buyer Details */}
      <div className="mb-4 rounded bg-white/50 p-3">
        <p className="text-sm font-medium text-gray-700">Deliver to:</p>
        <p className="text-sm text-gray-600">{order.buyer.name}</p>
        {order.buyer.phone && <p className="text-sm text-gray-600">{order.buyer.phone}</p>}
        {order.buyer.city && <p className="text-sm text-gray-600">{order.buyer.city}</p>}
        <p className="text-sm text-gray-600">{order.shippingAddress}</p>
      </div>

      {/* Actions */}
      {!hasShipment ? (
        <>
          {!showCourierSelect ? (
            <button
              onClick={() => setShowCourierSelect(true)}
              disabled={isLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
            >
              <Truck className="mr-2 inline-block h-4 w-4" />
              Generate Shipment
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Select Delivery Method:</p>
              {couriers.map((courier) => (
                <button
                  key={courier.id}
                  onClick={() => handleCreateShipment(courier.id)}
                  disabled={isLoading}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:bg-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{courier.name}</p>
                      <p className="text-xs text-gray-600">{courier.description}</p>
                    </div>
                    <p className="font-medium text-gray-900">{courier.price}</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setShowCourierSelect(false)}
                className="w-full rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      ) : (
        <div className="space-y-2">
          <div className="rounded bg-white/50 p-3">
            <p className="text-xs font-medium text-gray-600">TRACKING CODE</p>
            <p className="font-mono text-sm font-semibold text-gray-900">
              {order.shipment!.trackingCode}
            </p>
          </div>
          <div className="flex gap-2">
            {order.shipment!.labelUrl && (
              <a
                href={order.shipment!.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded bg-white px-3 py-2 text-center text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                <FileText className="mr-1 inline-block h-4 w-4" />
                Download Label
              </a>
            )}
            <a
              href={`/seller/orders/${order.id}`}
              className="flex-1 rounded bg-white px-3 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Package className="mr-1 inline-block h-4 w-4" />
              View Details
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
