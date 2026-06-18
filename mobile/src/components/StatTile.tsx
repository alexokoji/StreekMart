import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

// Shared KPI tile used by the seller / designer / admin dashboards.
// Soft-grey-on-white card with a coloured glyph chip on the top-left,
// large numeric value, label underneath, and an optional secondary line.
// Tones map to the same semantic colours the rest of the app uses so
// every "people-and-catalog" tile across the dashboards reads the same
// way at a glance.
export type StatTone = "primary" | "promo" | "gold" | "info" | "success";

export function StatTile({
  label,
  value,
  sub,
  glyph,
  tone = "primary",
  style,
}: {
  label: string;
  value: string | number;
  sub?: string;
  glyph?: React.ReactNode;
  tone?: StatTone;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const chipBg =
    tone === "promo"
      ? "rgba(217,70,239,0.15)"
      : tone === "gold"
        ? "rgba(207,159,50,0.18)"
        : tone === "info"
          ? "rgba(124,58,237,0.15)"
          : tone === "success"
            ? "rgba(10,116,52,0.15)"
            : t.accentSoft;
  const chipFg =
    tone === "promo"
      ? t.promo
      : tone === "gold"
        ? t.premium
        : tone === "info"
          ? t.cta
          : tone === "success"
            ? t.success.fg
            : t.accent;
  return (
    <View style={[styles.tile, { backgroundColor: t.card, borderColor: t.border }, style]}>
      <View style={[styles.glyph, { backgroundColor: chipBg }]}>
        {typeof glyph === "string" || glyph == null ? (
          <Text style={{ color: chipFg, fontSize: 16, fontWeight: "800" }}>{glyph ?? "•"}</Text>
        ) : (
          <View>{glyph}</View>
        )}
      </View>
      <Text style={[styles.value, { color: t.text }]}>{value}</Text>
      <Text style={[type.small, { color: t.textMuted }]} numberOfLines={1}>{label}</Text>
      {sub ? (
        <Text style={[type.small, { color: t.textFaint, marginTop: 2 }]} numberOfLines={1}>{sub}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  value: { fontSize: 22, fontWeight: "800" },
});
