import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";

// Selectable pill. Two visual presentations:
//   - "outlined" (default): white card with violet border when selected.
//     Used for product size pickers and filter chips.
//   - "filled": muted background when idle, solid violet when selected.
//     Used for the home category circles' adjacent text labels and
//     the "Sort / Filter" headers.
export function Chip({
  label,
  selected = false,
  onPress,
  variant = "outlined",
  leftIcon,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: "outlined" | "filled";
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const isFilled = variant === "filled";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected
            ? isFilled
              ? t.cta
              : t.scheme === "dark"
                ? t.bgElevated
                : "#fff"
            : isFilled
              ? t.scheme === "dark"
                ? t.bgElevated
                : "#f2f2f6"
              : "transparent",
          borderColor: selected ? t.cta : t.border,
          borderWidth: 1,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
      <Text
        style={[
          type.bodyStrong,
          {
            color: selected ? (isFilled ? t.ctaText : t.cta) : t.text,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { marginRight: 6 },
});
