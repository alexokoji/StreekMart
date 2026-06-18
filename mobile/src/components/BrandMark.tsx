import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { useTheme } from "../state/ThemeContext";

// Compact wordmark used at the top of the auth screens. Violet roundel
// with an "S" glyph next to the StreekMart text. Pass `size="hero"` for
// the larger version used on the Get Started splash.
export function BrandMark({
  size = "default",
  style,
}: {
  size?: "default" | "hero";
  style?: ViewStyle;
}) {
  const t = useTheme();
  const isHero = size === "hero";
  const roundel = isHero ? 56 : 38;
  const letter = isHero ? 30 : 20;
  const text = isHero ? 26 : 18;
  return (
    <View style={[styles.row, style]}>
      <View
        style={[
          styles.roundel,
          { width: roundel, height: roundel, borderRadius: roundel / 2, backgroundColor: t.cta },
        ]}
      >
        <Text style={[styles.letter, { fontSize: letter, color: t.ctaText }]}>S</Text>
      </View>
      <Text style={[styles.wordmark, { fontSize: text, color: t.text }]}>
        Streek<Text style={{ color: t.cta }}>Mart</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  roundel: { alignItems: "center", justifyContent: "center" },
  letter: { fontWeight: "900" },
  wordmark: { fontWeight: "800", letterSpacing: -0.3 },
});
