import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  salePrice: number | null;
  category: string;
  status: string;
  images: string[];
  seller: { id: string; name: string; businessName?: string | null };
  sizes?: string[];
  ratingAvg?: number;
  ratingCount?: number;
};

const { width } = Dimensions.get("window");

export function ProductDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "ProductDetail">>();
  const { id } = route.params;
  const t = useTheme();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ product: Product }>(`/api/products/${id}`);
      setProduct(data.product);
    } catch {
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addToCart() {
    if (!user) {
      Alert.alert("Sign in", "You need an account to add items to the cart.");
      return;
    }
    if (!product) return;
    setAdding(true);
    try {
      await api.post("/api/cart", { productId: product.id, quantity: 1 });
      Alert.alert("Added", `${product.name} is in your cart.`);
    } catch (err) {
      Alert.alert("Couldn't add", err instanceof Error ? err.message : "Try again.");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <Screen padding={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={t.cta} size="large" />
        </View>
      </Screen>
    );
  }
  if (!product) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.text }]}>Product not found.</Text>
      </Screen>
    );
  }

  const effective = product.salePrice ?? product.price;
  const hasDiscount = product.salePrice != null && product.salePrice < product.price;

  return (
    <Screen padding={false} scroll edges={[]}>
      {/* Image carousel */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {(product.images?.length ? product.images : [null]).map((img, i) => (
          <View key={i} style={{ width, aspectRatio: 1, backgroundColor: t.bgElevated }}>
            {img && (
              <Image
                source={{ uri: img }}
                style={styles.heroImage}
                contentFit="cover"
                transition={150}
              />
            )}
          </View>
        ))}
      </ScrollView>
      {product.images && product.images.length > 1 && (
        <View style={styles.dotsRow}>
          {product.images.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === activeImage ? t.cta : t.border },
              ]}
            />
          ))}
        </View>
      )}

      <View style={styles.content}>
        <Text style={[type.h1, { color: t.text }]}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={[type.display, { color: t.cta }]}>
            ₦{Math.round(effective).toLocaleString("en-NG")}
          </Text>
          {hasDiscount && (
            <Text
              style={[
                type.body,
                {
                  color: t.textMuted,
                  textDecorationLine: "line-through",
                  marginLeft: 10,
                },
              ]}
            >
              ₦{Math.round(product.price).toLocaleString("en-NG")}
            </Text>
          )}
        </View>
        <View style={[styles.sellerCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[type.small, { color: t.textMuted }]}>Sold by</Text>
          <Text style={[type.bodyStrong, { color: t.text, marginTop: 2 }]}>
            {product.seller.businessName ?? product.seller.name}
          </Text>
        </View>

        <Text style={[type.h2, { color: t.text, marginTop: 20 }]}>Description</Text>
        <Text style={[type.body, { color: t.textMuted, marginTop: 6, lineHeight: 22 }]}>
          {product.description}
        </Text>

        <Button label={adding ? "Adding…" : "Add to cart"} onPress={addToCart} loading={adding} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroImage: { width: "100%", height: "100%" },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  sellerCard: {
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
