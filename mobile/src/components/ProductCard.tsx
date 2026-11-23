import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

export type ProductCardData = {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  image: string | null;
  sellerName?: string;
  ratingAvg?: number;
  promoted?: boolean;
  saved?: boolean;
};

function formatNgn(value: number): string {
  return `₦${Math.round(value).toLocaleString("en-NG")}`;
}

// Product tile: a tall rounded image with the save heart and badges on it,
// then name and price underneath. No card chrome, so the goods carry the page.
export function ProductCard({
  product,
  onPress,
  onToggleSave,
  compact = false,
}: {
  product: ProductCardData;
  onPress?: () => void;
  onToggleSave?: () => void;
  compact?: boolean;
}) {
  const t = useTheme();
  const effectivePrice = product.salePrice ?? product.price;
  const hasDiscount = product.salePrice != null && product.salePrice < product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
    : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatNgn(effectivePrice)}`}
      style={({ pressed }) => [styles.card, compact ? styles.compact : null, { opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={[styles.imageWrap, { backgroundColor: t.border }]}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.image} contentFit="cover" transition={150} />
        ) : null}
        {product.promoted && (
          <View style={[styles.badge, styles.left, { backgroundColor: t.gold }]}>
            <Text style={[type.micro, { color: "#17121F" }]}>PROMO</Text>
          </View>
        )}
        {hasDiscount && (
          <View style={[styles.badge, styles.leftBottom, { backgroundColor: t.ink }]}>
            <Text style={[type.micro, { color: t.inkText }]}>-{discountPct}%</Text>
          </View>
        )}
        {onToggleSave && (
          <Pressable
            onPress={(e) => {
              e.stopPropagation && e.stopPropagation();
              onToggleSave();
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={product.saved ? "Remove from wishlist" : "Save to wishlist"}
            style={styles.heartBtn}
          >
            <Ionicons
              name={product.saved ? "heart" : "heart-outline"}
              size={19}
              color={product.saved ? "#C2392F" : "#17121F"}
            />
          </Pressable>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[type.price, { color: t.text }]}>{formatNgn(effectivePrice)}</Text>
          {hasDiscount && (
            <Text style={[type.small, { color: t.textMuted, textDecorationLine: "line-through", marginLeft: 6 }]}>
              {formatNgn(product.price)}
            </Text>
          )}
        </View>
        {product.sellerName ? (
          <Text style={[type.small, { color: t.textMuted }]} numberOfLines={1}>
            {product.sellerName}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  compact: { maxWidth: 170 },
  imageWrap: { aspectRatio: 4 / 5, borderRadius: radius.lg, overflow: "hidden", position: "relative" },
  image: { width: "100%", height: "100%" },
  body: { paddingTop: 10, gap: 3 },
  name: { fontSize: 14, fontWeight: "600", lineHeight: 18 },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  badge: { position: "absolute", paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.sm },
  left: { top: 10, left: 10 },
  leftBottom: { bottom: 10, left: 10 },
  heartBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
});
