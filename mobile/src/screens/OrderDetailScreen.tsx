import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { maybePromptForRating } from "../lib/rating";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type OrderDetail = {
  id: string;
  status: string;
  totalPrice: number;
  quantity: number;
  paymentMethod: string;
  paidAt: string | null;
  expectedDeliveryBy: string | null;
  shippedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  shippingAddress: string | null;
  trackingNumber: string | null;
  trackingProvider: string | null;
  deliveryCode: string | null;
  product: { id: string; name: string; image: string | null };
  seller: { id: string; name: string; businessName?: string | null };
};

const STEPS = [
  { key: "PENDING", label: "Order placed" },
  { key: "PAID", label: "Payment confirmed" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "COMPLETED", label: "Delivered" },
];

function stepIndex(status: string) {
  if (status === "CANCELLED") return -1;
  return Math.max(0, STEPS.findIndex((s) => s.key === status));
}

export function OrderDetailScreen() {
  const t = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "OrderDetail">>();
  const { id } = route.params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ order: OrderDetail }>(`/api/orders/${id}`);
      setOrder(data.order);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function confirm() {
    if (!order) return;
    if (code.length !== 4) {
      Alert.alert("Invalid code", "Enter the 4-digit code on the delivery receipt.");
      return;
    }
    setConfirming(true);
    try {
      await api.post(`/api/orders/${order.id}/confirm-by-code`, { code });
      await load();
      Alert.alert("Confirmed", "Thanks for confirming delivery.", [
        { text: "OK", onPress: () => { maybePromptForRating(); } },
      ]);
    } catch (err) {
      Alert.alert("Could not confirm", err instanceof Error ? err.message : "Try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </Screen>
    );
  }
  if (!order) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Order not found.</Text>
      </Screen>
    );
  }

  const idx = stepIndex(order.status);
  const cancelled = order.status === "CANCELLED";

  return (
    <Screen padding={false} scroll contentStyle={{ padding: 16, paddingBottom: 32 }}>
      {/* Product card */}
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {order.product.image && (
            <Image source={{ uri: order.product.image }} style={styles.thumb} contentFit="cover" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[type.h2, { color: t.text }]} numberOfLines={2}>{order.product.name}</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Qty {order.quantity} - by {order.seller.businessName ?? order.seller.name}
            </Text>
            <Text style={[type.display, { color: t.cta, marginTop: 6 }]}>
              N{Math.round(order.totalPrice).toLocaleString("en-NG")}
            </Text>
          </View>
        </View>
      </View>

      {/* Status timeline */}
      <View style={{ marginTop: 18 }}>
        <Text style={[type.h2, { color: t.text, marginBottom: 10 }]}>Status</Text>
        {cancelled ? (
          <View style={[styles.cancelledCard, { backgroundColor: t.danger.bg }]}>
            <Text style={[type.bodyStrong, { color: t.danger.fg }]}>Order cancelled</Text>
          </View>
        ) : (
          STEPS.map((s, i) => (
            <TimelineRow key={s.key} label={s.label} active={i <= idx} completed={i < idx} />
          ))
        )}
      </View>

      {/* Shipping info */}
      {order.shippingAddress && (
        <View style={{ marginTop: 18 }}>
          <Text style={[type.h2, { color: t.text }]}>Shipping</Text>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, marginTop: 8 }]}>
            <Text style={[type.body, { color: t.text }]}>{order.shippingAddress}</Text>
            {order.trackingNumber && (
              <Text style={[type.small, { color: t.textMuted, marginTop: 8 }]}>
                Tracking: <Text style={{ color: t.text, fontWeight: "600" }}>{order.trackingNumber}</Text>
                {order.trackingProvider ? ` via ${order.trackingProvider}` : ""}
              </Text>
            )}
            {order.expectedDeliveryBy && (
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                Expected by {new Date(order.expectedDeliveryBy).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Confirm delivery code -- buyer-side action on SHIPPED orders */}
      {order.status === "SHIPPED" && (
        <View style={{ marginTop: 18 }}>
          <Text style={[type.h2, { color: t.text }]}>Confirm delivery</Text>
          <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
            Enter the 4-digit code from the delivery person to confirm receipt.
          </Text>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, marginTop: 8 }]}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="1234"
              placeholderTextColor={t.textFaint}
              style={[styles.codeInput, { color: t.text, backgroundColor: t.bg, borderColor: t.border }]}
            />
            <Button label="Confirm delivery" loading={confirming} disabled={code.length !== 4} onPress={confirm} style={{ marginTop: 10 }} />
          </View>
        </View>
      )}

      {/* Delivery code reminder for shipped orders -- shown next to confirm */}
      {order.status === "PAID" && order.deliveryCode && (
        <View style={{ marginTop: 18 }}>
          <Text style={[type.h2, { color: t.text }]}>Delivery code</Text>
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, marginTop: 8 }]}>
            <Text style={[type.small, { color: t.textMuted }]}>Share this with the delivery person on arrival.</Text>
            <Text style={[type.display, { color: t.accent, marginTop: 8, letterSpacing: 8, textAlign: "center" }]}>
              {order.deliveryCode}
            </Text>
          </View>
        </View>
      )}
    </Screen>
  );
}

function TimelineRow({ label, active, completed }: { label: string; active: boolean; completed: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.timelineRow}>
      <View style={[styles.dot, { backgroundColor: active ? t.cta : t.border }]} />
      <Text style={[type.body, { color: active ? t.text : t.textMuted, marginLeft: 12, fontWeight: completed ? "400" : "600" }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 84, height: 84, borderRadius: radius.sm },
  cancelledCard: { padding: 14, borderRadius: radius.md, alignItems: "center" },
  timelineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  dot: { width: 14, height: 14, borderRadius: 999 },
  codeInput: {
    height: 60,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 8,
  },
});