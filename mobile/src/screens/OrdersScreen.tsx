import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { ProductCardSkeleton, Skeleton } from "../components/Skeleton";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { Button } from "../components/Button";
import { api } from "../api/client";
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
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Sign in to see your orders.</Text>
        <Button label="Sign in" style={{ marginTop: 12 }} onPress={() => nav.navigate("Login")} />
      </Screen>
    );
  }

  return (
    <Screen padding={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={[type.h1, { color: t.text }]}>My orders</Text>
        <View style={styles.tabs}>
          <Pressable onPress={() => setFilter("ACTIVE")} style={[styles.tab, { borderColor: filter === "ACTIVE" ? t.cta : t.border }]}>
            <Text style={[type.bodyStrong, { color: filter === "ACTIVE" ? t.cta : t.textMuted }]}>Active</Text>
          </Pressable>
          <Pressable onPress={() => setFilter("COMPLETED")} style={[styles.tab, { borderColor: filter === "COMPLETED" ? t.cta : t.border }]}>
            <Text style={[type.bodyStrong, { color: filter === "COMPLETED" ? t.cta : t.textMuted }]}>Completed</Text>
          </Pressable>
        </View>
      </View>
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[type.body, { color: t.textMuted }]}>
                No {filter.toLowerCase()} orders yet.
              </Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => {
            const sc = statusColor(t, item.status);
            return (
              <Pressable
                onPress={() => nav.navigate("OrderDetail", { id: item.id })}
                style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}
              >
                {item.product.image && (
                  <Image source={{ uri: item.product.image }} style={styles.thumb} contentFit="cover" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: t.text }]} numberOfLines={1}>{item.product.name}</Text>
                  <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
                    {new Date(item.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[type.bodyStrong, { color: t.cta }]}>
                      N{Math.round(item.totalPrice).toLocaleString("en-NG")}
                    </Text>
                    <Text style={[type.micro, { color: sc.fg, backgroundColor: sc.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { padding: 32, alignItems: "center" },
  tabs: { flexDirection: "row", gap: 8, marginTop: 14 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
});