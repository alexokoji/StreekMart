import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { LogoBar } from "../components/LogoBar";
import { BackHeader } from "../components/BackHeader";
import { Chip } from "../components/Chip";
import { Input } from "../components/Input";
import { ProductCardSkeleton } from "../components/Skeleton";
import { api } from "../api/client";
import { getCached } from "../api/cache";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import { goToTab } from "../navigation/goToTab";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Item = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
  image: string | null;
  sellerName?: string;
  ratingAvg?: number;
  ratingCount?: number;
};

type Sort = "trending" | "newest" | "price-low" | "price-high";

// Full-bleed product browse. When called from a home "View all" link,
// route.params.rail pins the query to that rail (e.g. "new-arrivals"),
// route.params.title swaps the LogoBar for a BackHeader showing the
// rail's name so it reads as a drill-down.
export function TrendingScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "Trending">>();
  const pinnedRail = route.params?.rail;
  const pinnedTitle = route.params?.title;

  const [items, setItems] = useState<Item[]>([]);
  const [sort, setSort] = useState<Sort>("trending");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      // If a rail is pinned via route params, lock the query to it so
      // the user sees exactly the products from the rail they tapped.
      // Sort is still respected (price-low / price-high re-orders the
      // pinned set client-side).
      const rail =
        pinnedRail ??
        (sort === "newest"
          ? "new-arrivals"
          : sort === "price-low" || sort === "price-high"
            ? "featured"
            : "best-sellers");
      const data = await getCached(`trending:${rail}`, () =>
        api.get<{ items: Item[] }>("/api/products/list", { rail, limit: 40 }),
      );
      let next = data.items ?? [];
      if (sort === "price-low") next = [...next].sort((a, b) => effective(a) - effective(b));
      if (sort === "price-high") next = [...next].sort((a, b) => effective(b) - effective(a));
      setItems(next);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sort, pinnedRail]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = query.trim()
    ? items.filter((p) =>
        p.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : items;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {pinnedTitle ? (
        <BackHeader title={pinnedTitle} />
      ) : (
        <LogoBar onMenu={() => nav.navigate("Menu" as never)} />
      )}
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        <Pressable onPress={() => goToTab(nav, "Search")}>
          <Input
            leftIcon={<Ionicons name="search" size={18} color={t.textMuted} />}
            value={query}
            onChangeText={setQuery}
            placeholder="Search products"
            editable
          />
        </Pressable>
      </View>

      <View style={styles.countRow}>
        <Text style={[type.h2, { color: t.text }]}>
          {(filtered.length || items.length).toLocaleString("en-NG")}+ items
        </Text>
        <View style={styles.sortRow}>
          <Chip
            label="Sort"
            variant="filled"
            leftIcon={<Ionicons name="swap-vertical" size={14} color={t.text} />}
            onPress={() => {
              const next: Sort =
                sort === "trending"
                  ? "newest"
                  : sort === "newest"
                    ? "price-low"
                    : sort === "price-low"
                      ? "price-high"
                      : "trending";
              setSort(next);
            }}
          />
          <Chip
            label="Filter"
            variant="filled"
            leftIcon={<Ionicons name="options-outline" size={14} color={t.text} />}
            onPress={() => {}}
          />
        </View>
      </View>

      {loading ? (
        <FlatList
          data={Array.from({ length: 6 })}
          keyExtractor={(_, i) => String(i)}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={() => (
            <View style={{ flex: 1 }}>
              <ProductCardSkeleton />
            </View>
          )}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 32 }}
          columnWrapperStyle={{ gap: 12 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[type.body, { color: t.textMuted }]}>No products to show right now.</Text>
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
            <GridCard item={item} onPress={() => nav.navigate("ProductDetail", { id: item.id })} />
          )}
        />
      )}
    </View>
  );
}

function effective(p: Item): number {
  return p.salePrice ?? p.price;
}

function GridCard({ item, onPress }: { item: Item; onPress: () => void }) {
  const t = useTheme();
  const eff = effective(item);
  const onSale = item.salePrice != null && item.salePrice < item.price;
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[styles.cardImageWrap, { backgroundColor: t.bg }]}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" />
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 4 }}>
        <Text style={[type.body, { color: t.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[type.bodyStrong, { color: t.cta }]}>
            ₦{Math.round(eff).toLocaleString("en-NG")}
          </Text>
          {onSale ? (
            <Text style={[type.small, { color: t.textMuted, textDecorationLine: "line-through", marginLeft: 6 }]}>
              ₦{Math.round(item.price).toLocaleString("en-NG")}
            </Text>
          ) : null}
        </View>
        {(item.ratingCount ?? 0) > 0 ? (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={t.premium} />
            <Text style={[type.small, { color: t.textMuted }]}>
              {(item.ratingAvg ?? 0).toFixed(1)} ({(item.ratingCount ?? 0).toLocaleString("en-NG")})
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  countRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sortRow: { flexDirection: "row", gap: 8 },
  card: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  cardImageWrap: { aspectRatio: 1 },
  cardImage: { width: "100%", height: "100%" },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  empty: { padding: 32, alignItems: "center" },
});
