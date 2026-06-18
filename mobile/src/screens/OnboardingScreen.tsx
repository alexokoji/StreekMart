import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../state/ThemeContext";
import { OnboardingDots } from "../components/OnboardingDots";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Tint = "violet" | "fuchsia" | "gold";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const SLIDES: Array<{ title: string; body: string; tint: Tint; icon: IconName }> = [
  {
    title: "Browse the catalog",
    body: "Materials, ready-to-wear, designer one-offs and pre-orders — all in one place.",
    tint: "violet",
    icon: "bag-handle-outline",
  },
  {
    title: "Order safely",
    body: "Pay through Korapay — we hold funds in escrow until your item arrives.",
    tint: "fuchsia",
    icon: "lock-closed-outline",
  },
  {
    title: "Chat with sellers",
    body: "Ask about sizing, request a custom piece, or follow your favourite designer's drops.",
    tint: "gold",
    icon: "chatbubbles-outline",
  },
];

const ONBOARDED_KEY = "streekmart:onboarded:v2";

export function OnboardingScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDED_KEY, "1").catch(() => {});
    nav.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={["top", "bottom"]}>
      <View style={styles.topRow}>
        <Text style={[type.body, { color: t.textMuted }]}>
          <Text style={{ color: t.text, fontWeight: "800" }}>{index + 1}</Text>
          <Text>/{SLIDES.length}</Text>
        </Text>
        <Pressable onPress={finish} hitSlop={10}>
          <Text style={[type.body, { color: t.textMuted, fontWeight: "700" }]}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.contentArea}>
        <Illustration tint={slide.tint} icon={slide.icon} />
        <View style={{ marginTop: 40 }}>
          <Text style={[styles.title, { color: t.text }]}>{slide.title}</Text>
          <Text style={[styles.body, { color: t.textMuted }]}>{slide.body}</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <OnboardingDots count={SLIDES.length} active={index} />
        <Pressable
          onPress={() => (isLast ? finish() : setIndex((i) => i + 1))}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={[type.bodyStrong, { color: t.ctaText, fontSize: 16 }]}>
            {isLast ? "Get started" : "Next"}
          </Text>
        </Pressable>
        {index > 0 ? (
          <Pressable
            onPress={() => setIndex((i) => i - 1)}
            hitSlop={10}
            style={{ alignSelf: "center", marginTop: 14 }}
          >
            <Text style={[type.body, { color: t.textMuted, fontWeight: "700" }]}>Back</Text>
          </Pressable>
        ) : (
          <View style={{ height: 14, marginTop: 14 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

// Per-slide hero card. Big tinted square with a contrasting glyph chip,
// plus a couple of decorative roundels that hint at variety rather than
// drawing a literal product. Brand colour rotates per slide.
function Illustration({ tint, icon }: { tint: Tint; icon: IconName }) {
  const t = useTheme();
  const bg =
    tint === "violet"
      ? t.cta
      : tint === "fuchsia"
        ? t.promo
        : t.premium;
  const fg = tint === "gold" ? "#1b1b1b" : "#ffffff";
  return (
    <View style={styles.illuWrap}>
      <View style={[styles.illuCard, { backgroundColor: bg }]}>
        <View style={[styles.illuBlobA, { backgroundColor: "rgba(255,255,255,0.18)" }]} />
        <View style={[styles.illuBlobB, { backgroundColor: "rgba(255,255,255,0.14)" }]} />
        <View style={[styles.illuGlyph, { backgroundColor: "rgba(255,255,255,0.95)" }]}>
          <Ionicons name={icon} size={56} color={bg} />
        </View>
      </View>
      <View style={[styles.illuPill, { backgroundColor: t.bg, borderColor: t.border }]}>
        <Text style={{ fontSize: 14, color: fg === "#1b1b1b" ? t.premium : bg, fontWeight: "800" }}>
          StreekMart
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  contentArea: { flex: 1, paddingHorizontal: 32, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12 },
  bottomRow: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  cta: {
    marginTop: 22,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  illuWrap: { alignItems: "center" },
  illuCard: {
    width: 240,
    height: 240,
    borderRadius: radius.xl,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  illuBlobA: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 999,
  },
  illuBlobB: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 110,
    height: 110,
    borderRadius: 999,
  },
  illuGlyph: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
  },
  illuPill: {
    marginTop: -18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
