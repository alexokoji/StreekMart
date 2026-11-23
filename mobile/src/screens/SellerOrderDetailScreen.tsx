import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { FormScreen } from "../components/FormScreen";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { SelectField } from "../components/SelectField";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// Seller view of one order: customer + address, move it through
// PENDING → PAID → SHIPPED (PATCH /api/orders/:id), and post tracking
// updates the buyer sees (POST /api/orders/:id/updates). Only the buyer can
// mark an order completed — that releases the escrowed funds.
type Order = {
  id: string;
  status: string;
  quantity: number;
  totalPrice: number;
  shippingFormattedAddress?: string | null;
  shippingAddress?: string | null;
  notes?: string | null;
  paymentMethod?: string;
  selectedAttributesJson?: string;
  product: { name: string };
  buyer: { name: string; email: string };
};
type Update = { id: string; kind: string; message: string; createdAt: string };

const NEXT: Record<string, { label: string; status: string; danger?: boolean }[]> = {
  PENDING: [{ label: "Mark as paid", status: "PAID" }, { label: "Cancel order", status: "CANCELLED", danger: true }],
  PAID: [{ label: "Mark as shipped", status: "SHIPPED" }, { label: "Cancel order", status: "CANCELLED", danger: true }],
  SHIPPED: [],
  COMPLETED: [],
  CANCELLED: [],
};

const KINDS = [
  { value: "STATUS", label: "Status update" },
  { value: "DISPATCHED", label: "Out for delivery" },
  { value: "ARRIVING", label: "Arriving soon" },
  { value: "NOTE", label: "Note (no notification)" },
];

export function SellerOrderDetailScreen() {
  const t = useTheme();
  const { id } = useRoute<RouteProp<RootStackParamList, "SellerOrderDetail">>().params;
  const [order, setOrder] = useState<Order | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("STATUS");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [o, u] = await Promise.all([
        api.get<{ order: Order }>(`/api/orders/${id}`),
        api.get<{ updates: Update[] }>(`/api/orders/${id}/updates`).catch(() => ({ updates: [] })),
      ]);
      setOrder(o.order);
      setUpdates(u.updates ?? []);
    } catch (err) {
      Alert.alert("Couldn't load order", err instanceof Error ? err.message : "Try again.");
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setStatus(status: string, label: string, danger?: boolean) {
    const go = async () => {
      setBusy(true);
      try {
        await api.patch(`/api/orders/${id}`, { status });
        await load();
      } catch (err) {
        Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.");
      } finally {
        setBusy(false);
      }
    };
    if (danger) {
      Alert.alert(label + "?", "The buyer will be refunded to their wallet.", [
        { text: "Back", style: "cancel" },
        { text: label, style: "destructive", onPress: go },
      ]);
    } else {
      await go();
    }
  }

  async function postUpdate() {
    if (message.trim().length < 2) return Alert.alert("Add a message", "Write a short update for the buyer.");
    setBusy(true);
    try {
      await api.post(`/api/orders/${id}/updates`, { kind, message: message.trim() });
      setMessage("");
      await load();
    } catch (err) {
      Alert.alert("Couldn't post", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!order) {
    return (
      <FormScreen title="Order">
        <ActivityIndicator color={t.cta} style={{ marginTop: 40 }} />
      </FormScreen>
    );
  }

  const actions = NEXT[order.status] ?? [];
  const address = order.shippingFormattedAddress ?? order.shippingAddress ?? "No address on file";
  const Card = ({ children }: { children: React.ReactNode }) => (
    <View style={{ backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 12 }}>
      {children}
    </View>
  );

  return (
    <FormScreen title={`Order ${order.id.slice(-6).toUpperCase()}`}>
      <Card>
        <Text style={[type.h2, { color: t.text }]}>{order.product?.name}</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 4 }]}>
          Qty {order.quantity} · ₦{Math.round(order.totalPrice).toLocaleString("en-NG")} · {order.status}
        </Text>
        {order.selectedAttributesJson && order.selectedAttributesJson !== "{}" ? (
          <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>
            {Object.entries(JSON.parse(order.selectedAttributesJson) as Record<string, string>)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={[type.bodyStrong, { color: t.text }]}>Deliver to</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 4 }]}>{order.buyer?.name}</Text>
        <Text style={[type.body, { color: t.textMuted }]}>{address}</Text>
        {order.notes ? <Text style={[type.small, { color: t.textMuted, marginTop: 6 }]}>Note: {order.notes}</Text> : null}
      </Card>

      {actions.length > 0 ? (
        <View style={{ gap: 10, marginBottom: 12 }}>
          {actions.map((a) => (
            <Button
              key={a.status}
              label={a.label}
              variant={a.danger ? "danger" : "primary"}
              disabled={busy}
              onPress={() => setStatus(a.status, a.label, a.danger)}
            />
          ))}
        </View>
      ) : (
        <Text style={[type.small, { color: t.textMuted, marginBottom: 12 }]}>
          {order.status === "SHIPPED"
            ? "Waiting for the buyer to confirm delivery. That releases your payment."
            : "No further actions."}
        </Text>
      )}

      {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
        <Card>
          <Text style={[type.bodyStrong, { color: t.text, marginBottom: 8 }]}>Tracking update</Text>
          <View style={{ gap: 10 }}>
            <SelectField title="Update type" value={kind} onChange={setKind} options={KINDS} />
            <Input placeholder="e.g. Handed to the rider" value={message} onChangeText={setMessage} multiline />
            <Button label="Post update" onPress={postUpdate} disabled={busy} variant="secondary" />
          </View>
        </Card>
      )}

      {updates.length > 0 && (
        <Card>
          <Text style={[type.bodyStrong, { color: t.text, marginBottom: 6 }]}>History</Text>
          {updates.map((u) => (
            <View key={u.id} style={{ marginBottom: 8 }}>
              <Text style={[type.body, { color: t.text }]}>{u.message}</Text>
              <Text style={[type.small, { color: t.textMuted }]}>
                {u.kind} · {new Date(u.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </FormScreen>
  );
}
