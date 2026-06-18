import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";

// Custom 5-slot bottom nav with a raised circular FAB at the centre.
// Order: Home | Wishlist | [Search FAB] | Cart | Account. Replaces the
// default flat row from @react-navigation/bottom-tabs so the centre
// item floats above the bar and uses the brand violet.
export function BottomNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTheme();

  return (
    <View style={[styles.barWrap, { backgroundColor: t.bgElevated, borderTopColor: t.border }]}>
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
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.tab}>
              <Ionicons name={iconFor(route.name, focused)} size={22} color={color} />
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
    paddingBottom: Platform.OS === "ios" ? 22 : 8,
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
});
