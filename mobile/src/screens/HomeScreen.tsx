import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { ProductCard, type ProductCardData } from "../components/ProductCard";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type RailItem = ProductCardData;

type CategoryItem = { name: string; image?: string | null };

type HomeData = {
  featured: RailItem[];
  flashSales: RailItem[];
  newArrivals: RailItem[];
  bestSellers: RailItem[];
  categories: CategoryItem[];
};

export function HomeScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [data, setData] = useState<HomeData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // The mobile app pulls the same rails the web home page renders.
      // Each list endpoint already shapes product cards correctly.
      const [featured, flashSales, newArrivals, bestSellers, categories] =
        await Promise.all([
          api.get<{ items: RailItem[] }>("/api/products/list", {
            rail: "featured",
            limit: 8,
          }).catch(() => ({ items: [] })),
          api.get<{ items: RailItem[] }>("/api/products/list", {
            rail: "flash-sales",
            limit: 8,
          }).catch(() => ({ items: [] })),
          api.get<{ items: RailItem[] }>("/api/products/list", {
            rail: "new-arrivals",
            limit: 8,
          }).catch(() => ({ items: [] })),
          api.get<{ items: RailItem[] }>("/api/products/list", {
            rail: "best-sellers",
            limit: 8,
          }).catch(() => ({ items: [] })),
          api
            .get<{ categories: Array<{ name: string }> }>("/api/categories")
            .catch(() => ({ categories: [] })),
        ]);

      setData({
        featured: featured.items ?? [],
        flashSales: flashSales.items ?? [],
        newArrivals: newArrivals.items ?? [],
        bestSellers: bestSellers.items ?? [],
        categories: (categories.categories ?? []).slice(0, 10).map((c) => ({
          name: c.name,
        })),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      padding={false}
      scroll
      contentStyle={{ paddingBottom: 32 }}
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
    >
      {/* Search trigger */}
      <View style={[styles.searchBar, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
        <Pressable
          onPress={() => nav.navigate("Search")}
          style={[styles.searchInput, { backgroundColor: t.bg }]}
        >
          <Text style={{ color: t.textMuted }}>Search StreekMart…</Text>
        </Pressable>
      </View>

      {/* Promo banner */}
      <View style={[styles.banner, { backgroundColor: t.cta }]}>
        <View style={styles.bannerCopy}>
          <Text style={[type.micro, { color: t.ctaText, opacity: 0.85 }]}>
            DEALS · LIMITED TIME
          </Text>
          <Text style={[type.h1, { color: t.ctaText, marginTop: 4 }]}>
            Up to 50% off flash sales
          </Text>
          <Text style={[type.small, { color: t.ctaText, opacity: 0.9, marginTop: 4 }]}>
            Tap any deal to grab it before it ends.
          </Text>
        </View>
      </View>

      {/* Categories */}
      {data && data.categories.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Browse categories" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catsRow}>
            {data.categories.map((c) => (
              <Pressable
                key={c.name}
                onPress={() => nav.navigate("Search")}
                style={[styles.catChip, { backgroundColor: t.bgElevated, borderColor: t.border }]}
              >
                <Text style={[type.small, { color: t.text, fontWeight: "600" }]}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Flash sales */}
      {data && data.flashSales.length > 0 && (
        <Rail
          title="🔥 Flash sales"
          subtitle="Limited-time discounts"
          items={data.flashSales}
          onPressItem={(id) => nav.navigate("ProductDetail", { id })}
        />
      )}

      {/* Featured */}
      {data && data.featured.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Featured for you" />
          <FlatList
            data={data.featured}
            keyExtractor={(p) => p.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item }) => (
              <View style={styles.gridCell}>
                <ProductCard
                  product={item}
                  onPress={() => nav.navigate("ProductDetail", { id: item.id })}
                />
              </View>
            )}
          />
        </View>
      )}

      {/* New arrivals */}
      {data && data.newArrivals.length > 0 && (
        <Rail
          title="New arrivals"
          subtitle="Fresh listings, just in"
          items={data.newArrivals}
          onPressItem={(id) => nav.navigate("ProductDetail", { id })}
        />
      )}

      {/* Best sellers */}
      {data && data.bestSellers.length > 0 && (
        <Rail
          title="Best sellers"
          subtitle="What buyers come back for"
          items={data.bestSellers}
          onPressItem={(id) => nav.navigate("ProductDetail", { id })}
        />
      )}
    </Screen>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.h2, { color: t.text }]}>{title}</Text>
      {action}
    </View>
  );
}

function Rail({
  title,
  subtitle,
  items,
  onPressItem,
}: {
  title: string;
  subtitle?: string;
  items: RailItem[];
  onPressItem: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={[type.h2, { color: t.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railRow}
      >
        {items.map((p) => (
          <View key={p.id} style={styles.railItem}>
            <ProductCard product={p} compact onPress={() => onPressItem(p.id)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    paddingHorizontal: 14,
    height: 42,
    borderRadius: radius.pill,
    justifyContent: "center",
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: radius.lg,
  },
  bannerCopy: { gap: 2 },
  section: { marginTop: 22, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  catsRow: { gap: 8, paddingVertical: 4 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  railRow: { gap: 10, paddingVertical: 4 },
  railItem: { width: 160 },
  gridRow: { gap: 12 },
  gridCell: { flex: 1 },
});
