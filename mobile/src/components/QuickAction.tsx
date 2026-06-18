import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

// Action tile used in the role dashboards. Coloured glyph chip on top,
// label + optional sub-line below. Sizes 1-up (full width) or 2-up
// (paired with siblings inside a flexWrap row) — the tile fills the
// container width when `style` doesn't constrain it.
export type ActionTone = "primary" | "promo" | "gold" | "info" | "success" | "danger";

export function QuickAction({
  label,
  sub,
  icon,
  tone = "primary",
  onPress,
  disabled,
  style,
}: {
  label: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: ActionTone;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const { bg, fg } = toneColors(t, tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: t.card,
          borderColor: t.border,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <View style={[styles.iconChip, { backgroundColor: bg }]}>
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement<{ color?: string }>, { color: fg })
          : icon}
      </View>
      <Text style={[type.bodyStrong, { color: t.text, marginTop: 10 }]} numberOfLines={1}>
        {label}
      </Text>
      {sub ? (
        <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

function toneColors(t: ReturnType<typeof useTheme>, tone: ActionTone) {
  switch (tone) {
    case "promo":
      return { bg: "rgba(217,70,239,0.15)", fg: t.promo };
    case "gold":
      return { bg: "rgba(207,159,50,0.18)", fg: t.premium };
    case "info":
      return { bg: "rgba(124,58,237,0.15)", fg: t.cta };
    case "success":
      return { bg: t.success.bg, fg: t.success.fg };
    case "danger":
      return { bg: t.danger.bg, fg: t.danger.fg };
    default:
      return { bg: t.accentSoft, fg: t.accent };
  }
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: "47%",
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
