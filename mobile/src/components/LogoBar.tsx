import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Image as RNImage } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { useTheme } from "../state/ThemeContext";
import { useAuth } from "../state/AuthContext";
import { goToTab } from "../navigation/goToTab";
import type { RootStackParamList } from "../navigation/RootNav";

// Top header used on Home and Trending. Hamburger on the left,
// StreekMart logo image in the centre, avatar on the right that routes
// to the Account tab. When the user has a profile picture we render
// that; otherwise we fall back to the name's first initial, and to a
// generic person glyph when signed out.
export function LogoBar({
  onMenu,
}: {
  onMenu?: () => void;
}) {
  const t = useTheme();
  const nav = useNavigation<NavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const avatarUrl = user?.avatarUrl ?? null;
  const initial = user?.name ? user.name.slice(0, 1).toUpperCase() : null;
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: t.bg }}>
      <View style={styles.row}>
        <Pressable onPress={onMenu} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="menu" size={26} color={t.text} />
        </Pressable>
        <View style={[styles.brand, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <RNImage
            source={require("../../assets/icon.png")}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>
        <Pressable
          onPress={() => goToTab(nav, "Account")}
          hitSlop={10}
          style={styles.iconBtn}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={[styles.avatar, { backgroundColor: t.cta }]}
              contentFit="cover"
              transition={120}
            />
          ) : initial ? (
            <View style={[styles.avatar, styles.avatarCenter, { backgroundColor: t.cta }]}>
              <Text style={{ color: t.ctaText, fontWeight: "700" }}>{initial}</Text>
            </View>
          ) : (
            <Ionicons name="person-circle-outline" size={30} color={t.text} />
          )}
        </Pressable>
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
  // Rounded chip around the brand mark — softens the hard-edged
  // square icon so it reads as a logo lozenge instead of a sticker.
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    width: 36,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  logo: { width: 36, height: 36 },
  avatar: { width: 32, height: 32, borderRadius: 16, overflow: "hidden" },
  avatarCenter: { alignItems: "center", justifyContent: "center" },
});
