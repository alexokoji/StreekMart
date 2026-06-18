// Shared in-app action page. Every seller / designer / admin quick
// action navigates here with route params (title, icon, tone) instead
// of opening the browser. Each surface keeps its own URL-style identity
// via the params and can later be peeled off into a fully-built screen
// without touching the dashboards that link to it.

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RouteProp } from "@react-navigation/native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export type ActionTone = "primary" | "promo" | "gold" | "info" | "success" | "danger";
export type ActionScreenParams = {
  title: string;
  subtitle?: string;
  // Ionicons glyph name. Stays a string so it serialises through nav state.
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  tone?: ActionTone;
  // Short blurb explaining what this surface will do once the full
  // implementation lands. Optional — defaults to a generic message.
  description?: string;
};

export function ActionScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, "Action">>();
  const {
    title,
    subtitle,
    iconName = "construct-outline",
    tone = "primary",
    description = "This in-app surface is part of the active StreekMart redesign. The data hooks are wired through the same APIs your dashboard uses, and the full UI for this action is coming in the next mobile update.",
  } = route.params;
  const { bg, fg } = toneColors(t, tone);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title={title} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: bg }]}>
          <View style={[styles.heroIcon, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
            <Ionicons name={iconName} size={36} color={fg} />
          </View>
          <Text style={[styles.heroTitle, { color: fg }]}>{title}</Text>
          {subtitle ? (
            <Text style={[type.body, { color: fg, opacity: 0.85, marginTop: 6, textAlign: "center" }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[type.bodyStrong, { color: t.text }]}>What to expect</Text>
          <Text style={[type.body, { color: t.textMuted, marginTop: 8, lineHeight: 22 }]}>
            {description}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, marginTop: 14 }]}>
          <View style={styles.cardHead}>
            <View style={[styles.smallIcon, { backgroundColor: t.accentSoft }]}>
              <Ionicons name="information-circle-outline" size={18} color={t.accent} />
            </View>
            <Text style={[type.bodyStrong, { color: t.text }]}>Need this now?</Text>
          </View>
          <Text style={[type.small, { color: t.textMuted, marginTop: 8 }]}>
            While the mobile flow ships, the same task is available on the website. We'll fold it
            into the app shortly.
          </Text>
        </View>

        <Pressable
          onPress={() => nav.goBack()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: t.cta, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={{ color: t.ctaText, fontWeight: "700", fontSize: 16 }}>Back to dashboard</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function toneColors(t: ReturnType<typeof useTheme>, tone: ActionTone): { bg: string; fg: string } {
  switch (tone) {
    case "promo":
      return { bg: t.promo, fg: "#ffffff" };
    case "gold":
      return { bg: t.premium, fg: "#1b1b1b" };
    case "info":
      return { bg: t.cta, fg: t.ctaText };
    case "success":
      return { bg: t.success.fg, fg: "#ffffff" };
    case "danger":
      return { bg: "#6b1a2a", fg: "#ffffff" };
    default:
      return { bg: t.cta, fg: t.ctaText };
  }
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  hero: {
    padding: 28,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginTop: 14,
    textAlign: "center",
  },
  card: {
    padding: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    marginTop: 28,
    height: 54,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
