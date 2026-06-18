import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../state/ThemeContext";
import { type } from "../theme/tokens";

// Top-bar with chevron-back on the left, centered title, and an optional
// right-side action slot (heart, cart, etc.). Used on detail / nested
// screens like Shopping Bag, Checkout, Product Detail, Forgot Password.
export function BackHeader({
  title,
  rightAction,
  onBack,
}: {
  title?: string;
  rightAction?: React.ReactNode;
  onBack?: () => void;
}) {
  const t = useTheme();
  const nav = useNavigation();
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: t.bg }}>
      <View style={styles.row}>
        <Pressable
          onPress={() => (onBack ? onBack() : nav.canGoBack() && nav.goBack())}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={24} color={t.text} />
        </Pressable>
        <View style={styles.titleWrap}>
          {title ? (
            <Text style={[type.h2, { color: t.text }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        <View style={styles.iconBtn}>{rightAction}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 52,
  },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1, alignItems: "center" },
});
