// Cart icon with a live count badge.
//
// Reads itemCount from CartContext so every render of this component
// across the app (BackHeader actions, BottomNav slot, dashboard
// rows) stays in sync with the real cart without each screen
// re-fetching.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { useCart } from "../state/CartContext";

export function CartIcon({
  size = 22,
  color,
  filled = false,
}: {
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  const t = useTheme();
  const { itemCount } = useCart();
  const iconColor = color ?? t.text;
  return (
    <View style={styles.wrap}>
      <Ionicons
        name={filled ? "bag-handle" : "bag-handle-outline"}
        size={size}
        color={iconColor}
      />
      {itemCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: t.cta, borderColor: t.bgElevated }]}>
          <Text style={[styles.badgeText, { color: t.ctaText }]} numberOfLines={1}>
            {itemCount > 99 ? "99+" : itemCount}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", padding: 2 },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800", lineHeight: 12 },
});
