import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SellerProduct = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  status: string;
  imagesJson?: string;
  images?: string[];
  stockCount?: number;
};

function firstImage(p: SellerProduct): string | null {
  if (p.images && p.images.length > 0) return p.images[0];
  if (p.imagesJson) {
    try {
      const arr = JSON.parse(p.imagesJson);
      if (Array.isArray(arr) && typeof arr[0] === "string") return arr[0];
    } catch {
      /* fall through */
    }
  }
  return null;
}

function statusColors(t: ReturnType<typeof useTheme>, status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "LIVE":
      return { fg: t.success.fg, bg: t.success.bg };
    case "DRAFT":
      return { fg: t.warning.fg, bg: t.warning.bg };
    case "PAUSED":
    case "OUT_OF_STOCK":
      return { fg: t.textMuted, bg: t.border };
    case "ARCHIVED":
    case "REMOVED":
      return { fg: t.danger.fg, bg: t.danger.bg };
    default:
      return { fg: t.accent, bg: t.accentSoft };
  }
}

export function SellerProductsScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [items, setItems] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<{ products: SellerProduct[] }>("/api/seller/products");
      setItems(data.products ?? []);
    } catch (err) {
      if (isNotFound(err)) {
        setItems([]);
      } else {
        setError(err instanceof Error ? err.message : "Try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function deleteProduct(id: string) {
    Alert.alert("Delete product?", "Buyers will no longer see this listing.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const prev = items;
          setItems((cur) => cur.filter((p) => p.id !== id));
          try {
            await api.delete(`/api/seller/products/${id}`);
          } catch (err) {
            setItems(prev);
            Alert.alert("Couldn't delete", err instanceof Error ? err.message : "Try again.");
          }
        },
      },
    ]);
  }

  return (
    <ListScaffold<SellerProduct>
      title="Manage products"
      rightAction={
        <Pressable onPress={() => nav.navigate("AddProduct")} hitSlop={8}>
          <Ionicons name="add" size={26} color={t.cta} />
        </Pressable>
      }
      data={items}
      keyExtractor={(p) => p.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      emptyIcon="bag-handle-outline"
      emptyTitle="No products yet"
      emptyMessage="Tap the + button above to list your first item."
      renderItem={({ item }) => {
        const img = firstImage(item);
        const sc = statusColors(t, item.status);
        const eff = item.salePrice ?? item.price;
        return (
          <View style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}>
            {img ? (
              <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, { backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }]}>
                <Ionicons name="image-outline" size={24} color={t.textFaint} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[type.body, { color: t.cta, marginTop: 4 }]}>
                ₦{Math.round(eff).toLocaleString("en-NG")}
              </Text>
              <View style={styles.metaRow}>
                <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                  <Text style={{ color: sc.fg, fontSize: 11, fontWeight: "800" }}>{item.status}</Text>
                </View>
                {typeof item.stockCount === "number" ? (
                  <Text style={[type.small, { color: t.textMuted }]}>{item.stockCount} in stock</Text>
                ) : null}
              </View>
            </View>
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={() => nav.navigate("ProductDetail", { id: item.id })}
                hitSlop={6}
              >
                <Ionicons name="eye-outline" size={20} color={t.text} />
              </Pressable>
              <Pressable onPress={() => deleteProduct(item.id)} hitSlop={6}>
                <Ionicons name="trash-outline" size={20} color={t.danger.fg} />
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 64, height: 64, borderRadius: radius.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
});
