import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../state/ThemeContext";
import { BrandMark } from "../components/BrandMark";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// First-launch splash. No remote hero image — the visual is built from
// brand-coloured composition so the screen is bulletproof offline and
// always asserts the brand colours.
export function GetStartedScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={[styles.hero, { backgroundColor: t.cta }]}>
          <View style={[styles.heroBlob, styles.heroBlob1, { backgroundColor: t.promo }]} />
          <View style={[styles.heroBlob, styles.heroBlob2, { backgroundColor: t.premium }]} />
          <View style={[styles.heroBlob, styles.heroBlob3, { backgroundColor: "rgba(255,255,255,0.18)" }]} />

          <View style={styles.heroCardsWrap}>
            <View style={[styles.heroCard, styles.heroCardLeft, { backgroundColor: "#ffffff" }]}>
              <View style={[styles.heroCardSwatch, { backgroundColor: t.promo }]} />
              <View style={styles.heroCardMeta}>
                <View style={[styles.heroCardBar, { backgroundColor: "#1b1b1b", width: 32 }]} />
                <View style={[styles.heroCardBar, { backgroundColor: t.cta, width: 22, marginTop: 4 }]} />
              </View>
            </View>
            <View style={[styles.heroCard, styles.heroCardMid, { backgroundColor: "#ffffff" }]}>
              <View style={[styles.heroCardSwatch, { backgroundColor: t.cta }]} />
              <View style={styles.heroCardMeta}>
                <View style={[styles.heroCardBar, { backgroundColor: "#1b1b1b", width: 40 }]} />
                <View style={[styles.heroCardBar, { backgroundColor: t.premium, width: 22, marginTop: 4 }]} />
              </View>
            </View>
            <View style={[styles.heroCard, styles.heroCardRight, { backgroundColor: "#ffffff" }]}>
              <View style={[styles.heroCardSwatch, { backgroundColor: t.premium }]} />
              <View style={styles.heroCardMeta}>
                <View style={[styles.heroCardBar, { backgroundColor: "#1b1b1b", width: 28 }]} />
                <View style={[styles.heroCardBar, { backgroundColor: t.promo, width: 22, marginTop: 4 }]} />
              </View>
            </View>
          </View>

          <View style={styles.brandWrap}>
            <BrandMark size="hero" />
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={[styles.headline, { color: t.text }]}>
            Style worth{" "}
            <Text style={{ color: t.cta }}>owning</Text>.
          </Text>
          <Text style={[type.body, { color: t.textMuted, marginTop: 10, lineHeight: 22 }]}>
            Shop independent designers and trusted sellers across Africa — escrow-protected, doorstep-delivered.
          </Text>
          <Pressable
            onPress={() => nav.navigate("Onboarding")}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[type.bodyStrong, { color: t.ctaText, fontSize: 16 }]}>Get started</Text>
          </Pressable>
          <View style={styles.signinRow}>
            <Text style={[type.body, { color: t.textMuted }]}>Already a member? </Text>
            <Pressable onPress={() => nav.navigate("Login")} hitSlop={6}>
              <Text style={[type.body, { color: t.cta, fontWeight: "700" }]}>Sign in</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    flex: 1,
    overflow: "hidden",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginHorizontal: -1,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  heroBlob: { position: "absolute", borderRadius: 999 },
  heroBlob1: { top: -60, right: -50, width: 220, height: 220, opacity: 0.55 },
  heroBlob2: { bottom: 40, left: -40, width: 160, height: 160, opacity: 0.4 },
  heroBlob3: { top: 80, left: 60, width: 80, height: 80 },
  brandWrap: { position: "absolute", top: 28, alignSelf: "center" },
  heroCardsWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: -8,
  },
  heroCard: {
    width: 130,
    height: 180,
    borderRadius: radius.lg,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  heroCardLeft: { transform: [{ rotate: "-8deg" }, { translateY: 16 }] },
  heroCardMid: { transform: [{ translateY: -8 }], zIndex: 2 },
  heroCardRight: { transform: [{ rotate: "8deg" }, { translateY: 16 }] },
  heroCardSwatch: {
    height: 110,
    borderRadius: radius.md,
  },
  heroCardMeta: { marginTop: 8 },
  heroCardBar: { height: 6, borderRadius: 3 },
  bottom: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 16 },
  headline: {
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  cta: {
    marginTop: 22,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  signinRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
});
