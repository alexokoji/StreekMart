import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { BackHeader } from "../components/BackHeader";
import { StatTile } from "../components/StatTile";
import { QuickAction } from "../components/QuickAction";
import { api } from "../api/client";
import { firstImage } from "../lib/productImage";
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
    product: { id: string; name: string; image?: string | null; imagesJson?: string | null };
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
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Seller" />
        <View style={styles.empty}>
          <Text style={[type.h2, { color: t.text }]}>Seller dashboard</Text>
          <Text style={[type.body, { color: t.textMuted, marginTop: 8, textAlign: "center" }]}>
            You need seller permissions to see this dashboard. Apply for a role change from the website to unlock the seller experience.
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Seller" />
        <View style={styles.empty}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Seller" />
      <FlatList
        data={data?.recentOrders ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        ListHeaderComponent={
          <View>
            <Text style={[styles.greeting, { color: t.text }]}>Hi, {user.name.split(" ")[0]}</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Here's how your shop is doing right now.
            </Text>

            <View style={styles.tileGrid}>
              <StatTile
                glyph={<Ionicons name="bag-handle-outline" size={18} color={t.accent} />}
                tone="primary"
                label="Products"
                value={data?.stats.productCount ?? 0}
                sub={`${data?.stats.activeProducts ?? 0} live`}
              />
              <StatTile
                glyph={<Ionicons name="cube-outline" size={18} color={t.cta} />}
                tone="info"
                label="Active orders"
                value={data?.stats.activeOrders ?? 0}
              />
              <StatTile
                glyph={<Ionicons name="checkmark-circle-outline" size={18} color={t.success.fg} />}
                tone="success"
                label="Completed"
                value={data?.stats.completedOrders ?? 0}
              />
              <StatTile
                glyph={<Ionicons name="cash-outline" size={18} color={t.premium} />}
                tone="gold"
                label="Pending payouts"
                value={data?.stats.pendingPayouts ?? 0}
              />
            </View>

            <Text style={[type.h2, { color: t.text, marginTop: 24, marginBottom: 10 }]}>
              Quick actions
            </Text>
            <View style={styles.tileGrid}>
              <QuickAction
                tone="primary"
                icon={<Ionicons name="add-circle-outline" size={22} />}
                label="Add product"
                sub="List a new item"
                onPress={() => nav.navigate("AddProduct")}
              />
              <QuickAction
                tone="info"
                icon={<MaterialCommunityIcons name="package-variant-closed" size={22} />}
                label="Manage products"
                sub={`${data?.stats.productCount ?? 0} listed`}
                onPress={() => nav.navigate("SellerProducts")}
              />
              <QuickAction
                tone="promo"
                icon={<Ionicons name="cube-outline" size={22} />}
                label="Orders"
                sub="Buyers, status, fulfilment"
                onPress={() => nav.navigate("Orders")}
              />
              <QuickAction
                tone="gold"
                icon={<Ionicons name="cash-outline" size={22} />}
                label="Payouts"
                sub="Withdraw your balance"
                onPress={() => nav.navigate("SellerPayouts")}
              />
              <QuickAction
                tone="success"
                icon={<Ionicons name="megaphone-outline" size={22} />}
                label="Promotions"
                sub="Run a sale or coupon"
                onPress={() => nav.navigate("SellerPromotions")}
              />
              <QuickAction
                tone="primary"
                icon={<Ionicons name="storefront-outline" size={22} />}
                label="Shop settings"
                sub="Brand, hours, payouts"
                onPress={() => nav.navigate("SellerSettings")}
              />
              <QuickAction
                tone="info"
                icon={<Ionicons name="shield-checkmark-outline" size={22} />}
                label="Get verified"
                sub="Submit documents for review"
                onPress={() => nav.navigate("Verification")}
              />
            </View>

            <Text style={[type.h2, { color: t.text, marginTop: 24, marginBottom: 10 }]}>
              Recent orders
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyOrders, { borderColor: t.border }]}>
            <Text style={[type.body, { color: t.textMuted }]}>No orders yet.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            tintColor={t.cta}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.navigate("OrderDetail", { id: item.id })}
            style={({ pressed }) => [
              styles.orderRow,
              { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {(() => {
              const img = firstImage(item.product);
              return img ? (
                <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, { backgroundColor: t.bg }]} />
              );
            })()}
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
                {item.product.name}
              </Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                Buyer: {item.buyer?.name ?? "Guest"}
              </Text>
              <View style={styles.orderMeta}>
                <Text style={[type.bodyStrong, { color: t.cta }]}>
                  ₦{Math.round(item.totalPrice).toLocaleString("en-NG")}
                </Text>
                <View style={[styles.statusChip, { backgroundColor: t.bg, borderColor: t.border }]}>
                  <Text style={[type.small, { color: t.text, fontWeight: "700" }]}>{item.status}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  greeting: { fontSize: 26, fontWeight: "800", marginTop: 6 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  emptyOrders: {
    padding: 24,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  orderRow: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
  orderMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
});
