import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../state/ThemeContext";
import { fontFamily } from "../theme/tokens";
import { StreekMark } from "./StreekMark";

// Compact lockup used at the top of the auth screens: the bag mark next to
// the serif wordmark. Pass `size="hero"` for the larger version.
export function BrandMark({
  size = "default",
  style,
}: {
  size?: "default" | "hero";
  style?: ViewStyle;
}) {
  const t = useTheme();
  const isHero = size === "hero";
  return (
    <View style={[styles.row, style]}>
      <StreekMark size={isHero ? 52 : 36} body={t.scheme === "dark" ? "#F6F3ED" : "#2B1760"} letter={t.scheme === "dark" ? "#5B21B6" : "#F6F3ED"} />
      <Text style={[styles.wordmark, { fontSize: isHero ? 34 : 26, color: t.text }]}>
        Streek<Text style={{ color: t.accent }}>Mart</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordmark: { fontFamily: fontFamily.serif, letterSpacing: -0.2 },
});
