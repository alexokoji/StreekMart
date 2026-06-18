import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { BackHeader } from "../components/BackHeader";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { firstImage } from "../lib/productImage";
import { sellerDisplayName } from "../lib/sellerName";
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
  product: { id: string; name: string; image?: string | null; imagesJson?: string | null };
  seller: { id: string; name: string; businessName?: string | null };
};

const STEPS = [
  { key: "PENDING", label: "Order placed" },
  { key: "PAID", label: "Payment confirmed" },
  { key: "SHIPPED", label: "On the way" },
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
      Alert.alert("Invalid code", "Enter the 4-digit code from the delivery receipt.");
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
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Order" />
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }
  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Order" />
        <View style={styles.centered}>
          <Text style={[type.body, { color: t.text }]}>Order not found.</Text>
        </View>
      </View>
    );
  }

  const idx = stepIndex(order.status);
  const cancelled = order.status === "CANCELLED";

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title={`Order #${order.id.slice(-6).toUpperCase()}`} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            {firstImage(order.product) ? (
              <Image source={{ uri: firstImage(order.product)! }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: t.bg }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.h2, { color: t.text }]} numberOfLines={2}>{order.product.name}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                Qty {order.quantity} · by {sellerDisplayName(order.seller)}
              </Text>
              <Text style={[styles.bigPrice, { color: t.cta }]}>
                ₦{Math.round(order.totalPrice).toLocaleString("en-NG")}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 10 }]}>Progress</Text>
        {cancelled ? (
          <View style={[styles.cancelledCard, { backgroundColor: t.danger.bg }]}>
            <Text style={[type.bodyStrong, { color: t.danger.fg }]}>Order cancelled</Text>
          </View>
        ) : (
          <View style={[styles.timeline, { backgroundColor: t.card, borderColor: t.border }]}>
            {STEPS.map((s, i) => (
              <TimelineRow
                key={s.key}
                label={s.label}
                active={i <= idx}
                current={i === idx}
                last={i === STEPS.length - 1}
              />
            ))}
          </View>
        )}

        {order.shippingAddress ? (
          <>
            <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 10 }]}>Shipping</Text>
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
              <Text style={[type.body, { color: t.text }]}>{order.shippingAddress}</Text>
              {order.trackingNumber ? (
                <Text style={[type.small, { color: t.textMuted, marginTop: 10 }]}>
                  Tracking: <Text style={{ color: t.text, fontWeight: "700" }}>{order.trackingNumber}</Text>
                  {order.trackingProvider ? ` via ${order.trackingProvider}` : ""}
                </Text>
              ) : null}
              {order.expectedDeliveryBy ? (
                <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                  Expected by {new Date(order.expectedDeliveryBy).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

        {order.status === "SHIPPED" ? (
          <>
            <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 4 }]}>Confirm delivery</Text>
            <Text style={[type.small, { color: t.textMuted, marginBottom: 8 }]}>
              Enter the 4-digit code from the delivery person to confirm receipt.
            </Text>
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
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
          </>
        ) : null}

        {order.status === "PAID" && order.deliveryCode ? (
          <>
            <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 4 }]}>Delivery code</Text>
            <Text style={[type.small, { color: t.textMuted, marginBottom: 8 }]}>
              Share this with the delivery person on arrival.
            </Text>
            <View style={[styles.card, { backgroundColor: t.cta }]}>
              <Text style={[styles.codeBig, { color: t.ctaText }]}>{order.deliveryCode}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TimelineRow({
  label,
  active,
  current,
  last,
}: {
  label: string;
  active: boolean;
  current: boolean;
  last: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View
          style={[
            styles.timelineDot,
            {
              backgroundColor: active ? t.cta : t.border,
              borderColor: current ? t.cta : "transparent",
              borderWidth: current ? 3 : 0,
            },
          ]}
        />
        {!last ? <View style={[styles.timelineLine, { backgroundColor: active ? t.cta : t.border }]} /> : null}
      </View>
      <Text style={[type.body, { color: active ? t.text : t.textMuted, fontWeight: current ? "700" : "500" }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  card: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 84, height: 84, borderRadius: radius.sm },
  bigPrice: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  cancelledCard: { padding: 14, borderRadius: radius.md, alignItems: "center" },
  timeline: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timelineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 38 },
  timelineRail: { alignItems: "center", width: 16, paddingTop: 2 },
  timelineDot: { width: 14, height: 14, borderRadius: 7 },
  timelineLine: { width: 2, flex: 1, marginTop: 2, minHeight: 18 },
  codeInput: {
    height: 60,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 8,
  },
  codeBig: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 12,
    textAlign: "center",
  },
});
