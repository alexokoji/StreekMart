import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme } from "../state/ThemeContext";
import { radius } from "../theme/tokens";

// Tiny pulsing skeleton primitive for the mobile app. Uses Animated rather
// than Reanimated so it works in screens that never imported Reanimated's
// worklet runtime. The pulse oscillates the opacity between 0.4 and 1.0
// over 1.2s.
export function Skeleton({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        { backgroundColor: t.border, opacity, borderRadius: radius.sm },
        style,
      ]}
    />
  );
}

// Pre-shaped product card. Matches ProductCard's aspect + body layout so
// the skeleton row keeps the grid from jumping when real data lands.
export function ProductCardSkeleton({ compact = false }: { compact?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, compact ? { maxWidth: 170 } : null]}>
      <Skeleton style={{ aspectRatio: 1, width: "100%", borderRadius: 0 }} />
      <View style={{ padding: 10, gap: 6 }}>
        <Skeleton style={{ width: "80%", height: 12 }} />
        <Skeleton style={{ width: "60%", height: 12 }} />
        <Skeleton style={{ width: "40%", height: 14 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", flex: 1 },
});