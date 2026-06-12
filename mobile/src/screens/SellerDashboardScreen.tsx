import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Resp = {
  stats: {
    productCount: number;
    activeProducts: number;
    activeOrders: number;
    completedOrders: number;
    pendingPayouts: number;
  };
  recentOrders: Array<{
    id: string;
    status: string;
    totalPrice: number;
    createdAt: string;
    product: { id: string; name: string; image: string | null };
    buyer: { id: string; name: string } | null;
  }>;
};

export function SellerDashboardScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.isSeller) {
      setLoading(false);
      return;
    }
    try {
      const d = await api.get<Resp>("/api/dashboard/seller");
      setData(d);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user?.isSeller) {
    return (
      <Screen>
        <Text style={[type.h2, { color: t.text }]}>Seller dashboard</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 8 }]}>
          You need seller permissions to see this dashboard. Apply for a role change from the website to unlock the seller experience.
        </Text>
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </Screen>
    );
  }

  return (
    <Screen padding={false}>
      <FlatList
        data={data?.recentOrders ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <View>
            <Text style={[type.h1, { color: t.text }]}>Seller</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Welcome back, {user.name.split(" ")[0]}
            </Text>
            <View style={styles.kpiGrid}>
              <Kpi label="Products" value={data?.stats.productCount ?? 0} sub={`${data?.stats.activeProducts ?? 0} active`} />
              <Kpi label="Active orders" value={data?.stats.activeOrders ?? 0} />
              <Kpi label="Completed orders" value={data?.stats.completedOrders ?? 0} />
              <Kpi label="Pending payouts" value={data?.stats.pendingPayouts ?? 0} />
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <Button label="+ Add product" style={{ flex: 1 }} onPress={() => nav.navigate("Tabs")} />
            </View>
            <Text style={[type.h2, { color: t.text, marginTop: 24, marginBottom: 8 }]}>Recent orders</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted }]}>No orders yet.</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.navigate("OrderDetail", { id: item.id })}
            style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}
          >
            {item.product.image && (
              <Image source={{ uri: item.product.image }} style={styles.thumb} contentFit="cover" />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { color: t.text }]} numberOfLines={1}>{item.product.name}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                buyer: {item.buyer?.name ?? "anonymous"}
              </Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                <Text style={[type.bodyStrong, { color: t.cta }]}>
                  N{Math.round(item.totalPrice).toLocaleString("en-NG")}
                </Text>
                <Text style={[type.micro, { color: t.textMuted, fontWeight: "600" }]}>{item.status}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={[type.micro, { color: t.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[type.h1, { color: t.text, marginTop: 2 }]}>{value}</Text>
      {sub && <Text style={[type.small, { color: t.textMuted }]}>{sub}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { padding: 24, alignItems: "center" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  kpi: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
});