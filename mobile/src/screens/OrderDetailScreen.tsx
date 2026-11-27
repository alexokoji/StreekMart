import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { RouteProp } from "@react-navigation/native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { BackHeader } from "../components/BackHeader";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { firstImage } from "../lib/productImage";
import { sellerDisplayName } from "../lib/sellerName";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type OrderDetail = {
  id: string;
  transferReference?: string | null;
  transferStatus?: string | null;
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

type Update = { id: string; kind: string; message: string; etaAt: string | null; createdAt: string };

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
  const nav = useNavigation<any>();
  const t = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "OrderDetail">>();
  const { id } = route.params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ order: OrderDetail }>(`/api/orders/${id}`);
      setOrder(data.order);
      api.get<{ updates: Update[] }>(`/api/orders/${id}/updates`).then((u) => setUpdates(u.updates ?? [])).catch(() => {});
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function cancelOrder() {
    if (!order) return;
    Alert.alert(
      "Cancel this order?",
      order.status === "PENDING"
        ? "You haven't paid yet, so nothing will be charged."
        : "If it's still within the delivery window the seller may need to agree first. Paid orders are refunded to your wallet.",
      [
        { text: "Keep order", style: "cancel" },
        {
          text: "Cancel order",
          style: "destructive",
          onPress: async () => {
            setCancelling(true);
            try {
              await api.patch(`/api/orders/${order.id}`, { status: "CANCELLED" });
              await load();
            } catch (err) {
              Alert.alert("Couldn't cancel", err instanceof Error ? err.message : "Try again.");
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
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

        {(order.status === "PAID" || order.status === "SHIPPED") && order.deliveryCode ? (
          <>
            <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 4 }]}>Delivery code</Text>
            <Text style={[type.small, { color: t.textMuted, marginBottom: 8 }]}>
              Share this with the dispatch rider when they arrive. They key it in to mark your order delivered.
            </Text>
            <View style={[styles.card, { backgroundColor: t.cta }]}>
              <Text style={[styles.codeBig, { color: t.ctaText }]}>{order.deliveryCode}</Text>
            </View>
          </>
        ) : null}

        {order.status === "COMPLETED" ? <SellerRating orderId={order.id} /> : null}

        {updates.length > 0 ? (
          <>
            <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 8 }]}>Updates from the seller</Text>
            <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, gap: 10 }]}>
              {updates.map((u) => (
                <View key={u.id}>
                  <Text style={[type.body, { color: t.text }]}>{u.message}</Text>
                  <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                    {new Date(u.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                    {u.etaAt ? ` · ETA ${new Date(u.etaAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}` : ""}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {order.status === "PENDING" && order.transferReference ? (
          <Button
            label={order.transferStatus === "PROOF_SUBMITTED" ? "Waiting for seller to confirm" : "Pay by bank transfer"}
            onPress={() => nav.navigate("Transfer", { reference: order.transferReference! })}
            style={{ marginTop: 22 }}
          />
        ) : null}

        {order.status === "PENDING" || order.status === "PAID" || order.status === "SHIPPED" ? (
          <Button
            label="Cancel order"
            variant="secondary"
            loading={cancelling}
            onPress={cancelOrder}
            style={{ marginTop: 22 }}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

// Rate the seller once the order is completed — same endpoint as the web's
// SellerRatingForm (POST /api/seller-reviews, editable for 30 days).
function SellerRating({ orderId }: { orderId: string }) {
  const t = useTheme();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (rating < 1) return Alert.alert("Pick a rating", "Tap the stars to rate this seller.");
    setBusy(true);
    try {
      await api.post("/api/seller-reviews", { orderId, rating, body: body.trim() || undefined });
      setDone(true);
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={[type.h2, { color: t.text, marginTop: 22, marginBottom: 8 }]}>Rate this seller</Text>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, gap: 12 }]}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} stars`}>
              <Ionicons name={n <= rating ? "star" : "star-outline"} size={32} color={t.premium} />
            </Pressable>
          ))}
        </View>
        <Input placeholder="Say a little about your experience (optional)" value={body} onChangeText={setBody} multiline />
        <Button label={done ? "Thanks, saved" : "Submit rating"} onPress={submit} loading={busy} disabled={done} />
      </View>
    </>
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
