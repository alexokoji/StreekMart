import React, { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BackHeader } from "../components/BackHeader";
import { ProductCardSkeleton } from "../components/Skeleton";
import { ProductCard, type ProductCardData } from "../components/ProductCard";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { sellerDisplayName } from "../lib/sellerName";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import { goToTab } from "../navigation/goToTab";

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

const FAB_CLEARANCE = 110;

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
            sellerName: sellerDisplayName(p.seller),
            saved: true,
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

  async function unsave(productId: string) {
    const prev = items;
    setItems((cur) => cur.filter((c) => c.id !== productId));
    try {
      await api.post("/api/favorites", { kind: "product", id: productId });
    } catch (err) {
      setItems(prev);
      Alert.alert("Couldn't remove", err instanceof Error ? err.message : "Try again.");
    }
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Wishlist" />
        <View style={styles.empty}>
          <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
            Sign in to save items to your wishlist.
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
      <BackHeader title={items.length === 0 ? "Wishlist" : `Wishlist · ${items.length}`} />
      {loading ? (
        <FlatList
          data={Array.from({ length: 6 })}
          keyExtractor={(_, i) => String(i)}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: FAB_CLEARANCE }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={() => (
            <View style={{ flex: 1 }}>
              <ProductCardSkeleton />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: FAB_CLEARANCE }}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[type.body, { color: t.textMuted, textAlign: "center" }]}>
                Tap the heart on any product to save it here.
              </Text>
              <Pressable
                onPress={() => goToTab(nav, "Home")}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1, marginTop: 16 },
                ]}
              >
                <Text style={{ color: t.ctaText, fontWeight: "700" }}>Browse products</Text>
              </Pressable>
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
            <View style={{ flex: 1 }}>
              <ProductCard
                product={item}
                onPress={() => nav.navigate("ProductDetail", { id: item.id })}
                onToggleSave={() => unsave(item.id)}
              />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  headline: { fontSize: 24, fontWeight: "800" },
  empty: { padding: 32, alignItems: "center" },
  pill: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
});
