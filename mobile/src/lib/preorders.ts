// Preorder status labels, mirroring the website's src/lib/preorders.ts.
export function preorderStatusLabel(status: string): string {
  switch (status) {
    case "PENDING_PAYMENT": return "Awaiting payment";
    case "AWAITING_READY": return "In production";
    case "READY": return "Ready, pay delivery";
    case "AWAITING_SHIPMENT": return "Awaiting shipment";
    case "SHIPPED": return "Shipped";
    case "COMPLETED": return "Completed";
    case "CANCELLED": return "Cancelled";
    default: return status;
  }
}

export function preorderTone(status: string): "success" | "warning" | "danger" | "info" {
  if (status === "COMPLETED" || status === "SHIPPED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "PENDING_PAYMENT" || status === "READY") return "warning";
  return "info";
}
