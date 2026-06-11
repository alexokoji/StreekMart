import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
}: {
  label: string;
  onPress?: PressableProps["onPress"];
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();

  let bg: string;
  let fg: string;
  let border: string | undefined;
  switch (variant) {
    case "primary":
      bg = t.cta;
      fg = t.ctaText;
      break;
    case "secondary":
      bg = t.bgElevated;
      fg = t.text;
      border = t.border;
      break;
    case "ghost":
      bg = "transparent";
      fg = t.text;
      break;
    case "danger":
      bg = t.danger.bg;
      fg = t.danger.fg;
      break;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed && variant === "primary" ? t.ctaPressed : bg,
          opacity: disabled ? 0.55 : 1,
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          borderColor: border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: type.bodyStrong,
});
