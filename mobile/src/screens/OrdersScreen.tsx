import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { firstImage } from "../lib/productImage";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type OrderRow = {
  id: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  product: { id: string; name: string; imagesJson?: string; image?: string | null };
};

function statusColor(t: ReturnType<typeof useTheme>, status: string) {
  switch (status) {
    case "PAID": return { fg: t.success.fg, bg: t.success.bg };
    case "SHIPPED": return { fg: t.accent, bg: t.accentSoft };
    case "COMPLETED": return { fg: t.success.fg, bg: t.success.bg };
    case "CANCELLED": return { fg: t.danger.fg, bg: t.danger.bg };
    default: return { fg: t.warning.fg, bg: t.warning.bg };
  }
}

export function OrdersScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"ACTIVE" | "COMPLETED">("ACTIVE");

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<{ orders: OrderRow[] }>("/api/orders", { scope: "buyer", status: filter });
      setOrders(data.orders ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="My orders" />
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
            Sign in to track your purchases.
          </Text>
          <Pressable
            onPress={() => nav.navigate("Login")}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1, marginTop: 16 },
            ]}
          >
            <Text style={{ color: t.ctaText, fontWeight: "700" }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="My orders" />
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setFilter("ACTIVE")}
          style={[
            styles.tab,
            {
              backgroundColor: filter === "ACTIVE" ? t.cta : "transparent",
              borderColor: filter === "ACTIVE" ? t.cta : t.border,
            },
          ]}
        >
          <Text style={[type.bodyStrong, { color: filter === "ACTIVE" ? t.ctaText : t.textMuted }]}>
            Active
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setFilter("COMPLETED")}
          style={[
            styles.tab,
            {
              backgroundColor: filter === "COMPLETED" ? t.cta : "transparent",
              borderColor: filter === "COMPLETED" ? t.cta : t.border,
            },
          ]}
        >
          <Text style={[type.bodyStrong, { color: filter === "COMPLETED" ? t.ctaText : t.textMuted }]}>
            Completed
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
                {filter === "ACTIVE"
                  ? "Nothing in progress. Time to shop?"
                  : "No completed orders yet."}
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={t.cta}
              onRefresh={() => { setRefreshing(true); load(); }}
            />
          }
          renderItem={({ item }) => {
            const sc = statusColor(t, item.status);
            const img = firstImage(item.product);
            return (
              <Pressable
                onPress={() => nav.navigate("OrderDetail", { id: item.id })}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                {img ? (
                  <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, { backgroundColor: t.bg }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                    {new Date(item.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[type.bodyStrong, { color: t.cta }]}>
                      ₦{Math.round(item.totalPrice).toLocaleString("en-NG")}
                    </Text>
                    <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                      <Text style={{ color: sc.fg, fontSize: 11, fontWeight: "800" }}>
                        {item.status}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  empty: { padding: 32, alignItems: "center" },
  pill: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 72, height: 72, borderRadius: radius.sm },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});
