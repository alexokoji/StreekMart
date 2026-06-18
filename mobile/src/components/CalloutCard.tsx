import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

// Horizontal callout banner: solid color background, headline + optional
// caption on the left, "View all" affordance on the right. Used on Home
// for "Deal of the Day", "Trending Products", and similar promo blocks.
// Tone picks one of the brand semantic colours so a section's vibe
// (deal vs trending vs offer) reads at a glance.
export type CalloutTone = "primary" | "promo" | "gold" | "info";

export function CalloutCard({
  title,
  caption,
  ctaLabel = "View all",
  onPress,
  tone = "primary",
  style,
}: {
  title: string;
  caption?: string;
  ctaLabel?: string;
  onPress?: () => void;
  tone?: CalloutTone;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const bg =
    tone === "promo"
      ? t.promo
      : tone === "gold"
        ? t.premium
        : tone === "info"
          ? t.accent
          : t.cta;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: bg, opacity: pressed ? 0.9 : 1 },
        style,
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[type.h2, { color: t.ctaText }]}>{title}</Text>
        {caption ? (
          <View style={styles.captionRow}>
            <Text style={[type.small, { color: t.ctaText, opacity: 0.92 }]}>{caption}</Text>
          </View>
        ) : null}
      </View>
      {onPress ? (
        <View style={[styles.viewAll, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
          <Text style={[type.bodyStrong, { color: t.ctaText }]}>{ctaLabel} ›</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: radius.md,
  },
  captionRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
  viewAll: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
});
