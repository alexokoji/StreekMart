import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../state/ThemeContext";
import { useCart } from "../state/CartContext";

// Floating pill tab bar. A solid ink capsule sits above the page; the active
// tab expands into a violet pill with its label, the rest are icon-only.
// The wrapper keeps the page background and takes up layout space, so screen
// content never slides underneath the bar.
export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const { itemCount } = useCart();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: t.bg, paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View style={[styles.pill, { backgroundColor: t.ink, shadowColor: "#000" }]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string" ? options.tabBarLabel : options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name, route.params as object | undefined);
            }
          };

          const showBadge = route.name === "Cart" && itemCount > 0;
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={showBadge ? `${label}, ${itemCount} items` : label}
              style={[styles.tab, focused && { backgroundColor: t.cta, paddingHorizontal: 16 }]}
            >
              <Ionicons
                name={iconFor(route.name, focused)}
                size={22}
                color={focused ? t.ctaText : "#CFC8E0"}
              />
              {focused ? (
                <Text style={[styles.label, { color: t.ctaText }]} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
              {showBadge ? (
                <View style={[styles.badge, { backgroundColor: t.gold, borderColor: t.ink }]}>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {itemCount > 99 ? "99+" : itemCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function iconFor(
  routeName: string,
  filled: boolean,
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (routeName) {
    case "Home":
      return filled ? "home" : "home-outline";
    case "Feed":
      return filled ? "aperture" : "aperture-outline";
    case "Search":
      return "search";
    case "Cart":
      return filled ? "bag-handle" : "bag-handle-outline";
    case "Account":
      return filled ? "person" : "person-outline";
    default:
      return "ellipse-outline";
  }
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  pill: {
    height: 68,
    borderRadius: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  tab: {
    height: 48,
    minWidth: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: { fontSize: 13, fontWeight: "700" },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#17121F", lineHeight: 12 },
});
