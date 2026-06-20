import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { useCart } from "../state/CartContext";

// Custom 5-slot bottom nav with a raised circular FAB at the centre.
// Order: Home | Wishlist | [Search FAB] | Cart | Account. Replaces the
// default flat row from @react-navigation/bottom-tabs so the centre
// item floats above the bar and uses the brand violet.
export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const { itemCount } = useCart();
  // Respect the device's gesture / nav bar — phones with a gesture
  // pill (modern Android + every iPhone since X) report a non-zero
  // bottom inset. Without it, the tab bar tucks under the system bar
  // and the bottom row of labels gets clipped.
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.barWrap,
        { backgroundColor: t.bgElevated, borderTopColor: t.border, paddingBottom: bottomPadding },
      ]}
    >
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const isCenter = index === Math.floor(state.routes.length / 2);
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params as object | undefined);
            }
          };

          if (isCenter) {
            return (
              <View key={route.key} style={styles.centerSlot}>
                <Pressable
                  onPress={onPress}
                  style={({ pressed }) => [
                    styles.fab,
                    {
                      backgroundColor: t.cta,
                      shadowColor: t.cta,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons name={iconFor(route.name, true)} size={26} color={t.ctaText} />
                </Pressable>
              </View>
            );
          }

          const color = focused ? t.cta : t.textMuted;
          const showCartBadge = route.name === "Cart" && itemCount > 0;
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tab}>
              <View>
                <Ionicons name={iconFor(route.name, focused)} size={22} color={color} />
                {showCartBadge ? (
                  <View style={[styles.badge, { backgroundColor: t.cta, borderColor: t.bgElevated }]}>
                    <Text style={[styles.badgeText, { color: t.ctaText }]} numberOfLines={1}>
                      {itemCount > 99 ? "99+" : itemCount}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  styles.label,
                  { color, fontWeight: focused ? "700" : "500" },
                ]}
              >
                {label}
              </Text>
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
      return filled ? "sparkles" : "sparkles-outline";
    case "Wishlist":
      return filled ? "heart" : "heart-outline";
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
  barWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  row: { flexDirection: "row", alignItems: "flex-end", height: 62 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { fontSize: 10 },
  centerSlot: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9, fontWeight: "800", lineHeight: 11 },
});
