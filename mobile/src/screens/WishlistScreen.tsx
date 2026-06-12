import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { ProductCardSkeleton, Skeleton } from "../components/Skeleton";
import { Button } from "../components/Button";
import { ProductCard, type ProductCardData } from "../components/ProductCard";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FavoriteResp = {
  favorites: Array<{
    id: string;
    productId: string | null;
    product: {
      id: string;
      name: string;
      price: number;
      salePrice: number | null;
      imagesJson: string;
      seller: { name: string; businessName?: string | null };
    } | null;
  }>;
};

export function WishlistScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<FavoriteResp>("/api/favorites");
      const products: ProductCardData[] = (data.favorites ?? [])
        .filter((f) => f.product)
        .map((f) => {
          const p = f.product!;
          let image: string | null = null;
          try {
            const arr = JSON.parse(p.imagesJson) as string[];
            if (Array.isArray(arr)) image = arr[0] ?? null;
          } catch {
            image = null;
          }
          return {
            id: p.id,
            name: p.name,
            price: p.price,
            salePrice: p.salePrice,
            image,
            sellerName: p.seller.businessName ?? p.seller.name,
          };
        });
      setItems(products);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Sign in to see your saved items.</Text>
        <Button label="Sign in" style={{ marginTop: 12 }} onPress={() => nav.navigate("Login")} />
      </Screen>
    );
  }
  if (loading) {
    return (
      <Screen padding={false} scroll contentStyle={{ padding: 12, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12 }}><ProductCardSkeleton /><ProductCardSkeleton /></View>
        <View style={{ flexDirection: "row", gap: 12 }}><ProductCardSkeleton /><ProductCardSkeleton /></View>
        <View style={{ flexDirection: "row", gap: 12 }}><ProductCardSkeleton /><ProductCardSkeleton /></View>
      </Screen>
    );
  }
  return (
    <Screen padding={false}>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={2}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        columnWrapperStyle={{ gap: 12 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 4, paddingBottom: 12 }}>
            <Text style={[type.h1, { color: t.text }]}>Saved items</Text>
            <Text style={[type.small, { color: t.textMuted, marginTop: 4 }]}>
              Tap the heart on any product to save it here.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[type.body, { color: t.textMuted }]}>
              Nothing saved yet.
            </Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <ProductCard product={item} onPress={() => nav.navigate("ProductDetail", { id: item.id })} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { padding: 32, alignItems: "center" },
});