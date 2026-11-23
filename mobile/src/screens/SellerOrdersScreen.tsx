import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// Orders customers placed with this seller — the same list as the web's
// /seller/orders/active and /seller/orders/completed
// (GET /api/orders?scope=seller&status=ACTIVE|COMPLETED).
type SellerOrder = {
  id: string;
  status: string;
  quantity: number;
  totalPrice: number;
  createdAt: string;
  product: { name: string; imagesJson?: string };
  buyer: { name: string };
};

export function orderStatusColors(t: ReturnType<typeof useTheme>, status: string) {
  switch (status) {
    case "COMPLETED":
      return { fg: t.success.fg, bg: t.success.bg };
    case "CANCELLED":
      return { fg: t.danger.fg, bg: t.danger.bg };
    case "PENDING":
    case "PAID":
      return { fg: t.warning.fg, bg: t.warning.bg };
    default:
      return { fg: t.accent, bg: t.accentSoft };
  }
}

export function firstImageOf(json?: string): string | null {
  try {
    const arr = JSON.parse(json ?? "[]");
    return Array.isArray(arr) && typeof arr[0] === "string" ? arr[0] : null;
  } catch {
    return null;
  }
}

export function SellerOrdersScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "SellerOrders">>();
  const [tab, setTab] = useState<"ACTIVE" | "COMPLETED">(route.params?.tab ?? "ACTIVE");
  const [items, setItems] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.get<{ orders: SellerOrder[] }>("/api/orders", { scope: "seller", status: tab });
      setItems(d.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const header = (
    <View style={styles.tabs}>
      {(["ACTIVE", "COMPLETED"] as const).map((k) => (
        <Pressable
          key={k}
          onPress={() => setTab(k)}
          style={[styles.tab, { backgroundColor: tab === k ? t.cta : t.card, borderColor: t.border }]}
        >
          <Text style={{ color: tab === k ? t.ctaText : t.text, fontWeight: "700" }}>
            {k === "ACTIVE" ? "Active" : "Completed"}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <ListScaffold<SellerOrder>
      title="Orders"
      data={items}
      keyExtractor={(o) => o.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      ListHeader={header}
      emptyIcon="receipt-outline"
      emptyTitle={tab === "ACTIVE" ? "No active orders" : "No completed orders"}
      emptyMessage="Orders from customers appear here."
      renderItem={({ item }) => {
        const sc = orderStatusColors(t, item.status);
        const img = firstImageOf(item.product?.imagesJson);
        return (
          <Pressable
            onPress={() => nav.navigate("SellerOrderDetail", { id: item.id })}
            style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}
          >
            {img ? (
              <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: t.bg }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>{item.product?.name}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                {item.buyer?.name} · qty {item.quantity} · ₦{Math.round(item.totalPrice).toLocaleString("en-NG")}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: sc.bg }]}>
              <Text style={{ color: sc.fg, fontSize: 11, fontWeight: "800" }}>{item.status}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 8, marginBottom: 10 },
  tab: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
});
