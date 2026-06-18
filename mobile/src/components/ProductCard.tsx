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
  return `Ã¢â€šÂ¦${Math.round(value).toLocaleString("en-NG")}`;
}

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
  const hasDiscount =
    product.salePrice != null && product.salePrice < product.price;
  const discountPct = hasDiscount
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
    : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          opacity: pressed ? 0.85 : 1,
        },
        compact ? styles.compact : null,
      ]}
    >
      <View style={[styles.imageWrap, { backgroundColor: t.bgElevated }]}>
        {product.image && (
          <Image
            source={{ uri: product.image }}
            style={styles.image}
            contentFit="cover"
            transition={120}
          />
        )}
        {product.promoted && (
          <View style={[styles.promotedBadge, { backgroundColor: t.accent }]}>
            <Text style={[type.micro, { color: t.ctaText }]}>PROMO</Text>
          </View>
        )}
        {hasDiscount && (
          <View style={[styles.discountBadge, { backgroundColor: t.promo }]}>
            <Text style={[type.micro, { color: t.ctaText }]}>-{discountPct}%</Text>
          </View>
        )}
        {onToggleSave && (
          <Pressable
            onPress={(e) => { e.stopPropagation && e.stopPropagation(); onToggleSave(); }}
            hitSlop={8}
            style={styles.heartBtn}
          >
            <Ionicons
              name={product.saved ? "heart" : "heart-outline"}
              size={18}
              color={product.saved ? t.promo : t.textMuted}
            />
          </Pressable>
        )}
      </View>
      <View style={styles.body}>
        <Text style={[type.body, { color: t.text }]} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[type.bodyStrong, { color: t.cta }]}>
            {formatNgn(effectivePrice)}
          </Text>
          {hasDiscount && (
            <Text
              style={[
                type.small,
                {
                  color: t.textMuted,
                  textDecorationLine: "line-through",
                  marginLeft: 6,
                },
              ]}
            >
              {formatNgn(product.price)}
            </Text>
          )}
        </View>
        {product.sellerName && (
          <Text style={[type.small, { color: t.textMuted }]} numberOfLines={1}>
            {product.sellerName}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    flex: 1,
  },
  compact: { maxWidth: 170 },
  imageWrap: { aspectRatio: 1, position: "relative" },
  image: { width: "100%", height: "100%" },
  body: { padding: 10, gap: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline" },
  promotedBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heartBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
});
