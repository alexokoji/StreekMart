import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BackHeader } from "../components/BackHeader";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";
import { goToTab } from "../navigation/goToTab";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Resp = { groups: Record<string, string[]> };

type GroupIcon =
  | { lib: "ionicons"; name: React.ComponentProps<typeof Ionicons>["name"] }
  | { lib: "material"; name: React.ComponentProps<typeof MaterialCommunityIcons>["name"] };

function iconForGroup(name: string): GroupIcon {
  const k = name.toLowerCase();
  if (k.includes("cloth") || k.includes("apparel")) return { lib: "material", name: "tshirt-crew" };
  if (k.includes("material") || k.includes("fabric")) return { lib: "material", name: "palette-swatch" };
  if (k.includes("access")) return { lib: "material", name: "bag-personal" };
  if (k.includes("beauty") || k.includes("cosmetic")) return { lib: "material", name: "lipstick" };
  if (k.includes("shoe") || k.includes("foot")) return { lib: "material", name: "shoe-heel" };
  if (k.includes("jewel")) return { lib: "ionicons", name: "diamond-outline" };
  if (k.includes("kid") || k.includes("child")) return { lib: "material", name: "teddy-bear" };
  if (k.includes("home")) return { lib: "ionicons", name: "home-outline" };
  if (k.includes("trad") || k.includes("ankara")) return { lib: "material", name: "flower" };
  return { lib: "ionicons", name: "pricetag-outline" };
}

const TONES = ["primary", "promo", "gold", "info", "success"] as const;
type Tone = typeof TONES[number];

function toneChip(t: ReturnType<typeof useTheme>, tone: Tone) {
  switch (tone) {
    case "promo": return { bg: "rgba(217,70,239,0.15)", fg: t.promo };
    case "gold": return { bg: "rgba(207,159,50,0.18)", fg: t.premium };
    case "info": return { bg: "rgba(124,58,237,0.15)", fg: t.cta };
    case "success": return { bg: t.success.bg, fg: t.success.fg };
    default: return { bg: t.accentSoft, fg: t.accent };
  }
}

export function CategoriesScreen() {
  const t = useTheme();
  const nav = useNavigation<Nav>();
  const [groups, setGroups] = useState<Resp["groups"]>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Resp>("/api/categories", { grouped: "1" });
      setGroups(data.groups ?? {});
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <BackHeader title="Categories" />
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </View>
    );
  }

  const entries = Object.entries(groups);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <BackHeader title="Categories" />
      <FlatList
        data={entries}
        keyExtractor={([k]) => k}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListHeaderComponent={
          <Text style={[type.small, { color: t.textMuted, marginBottom: 4 }]}>
            Browse by what you're after — tap a category to start shopping it.
          </Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        renderItem={({ item: [groupName, cats], index }) => {
          const isOpen = expanded === groupName;
          const tone = TONES[index % TONES.length];
          const cc = toneChip(t, tone);
          return (
            <View style={[styles.groupCard, { backgroundColor: t.card, borderColor: t.border }]}>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : groupName)}
                style={styles.groupHeader}
              >
                <View style={[styles.glyph, { backgroundColor: cc.bg }]}>
                  {(() => {
                    const ic = iconForGroup(groupName);
                    return ic.lib === "ionicons" ? (
                      <Ionicons name={ic.name} size={20} color={cc.fg} />
                    ) : (
                      <MaterialCommunityIcons name={ic.name} size={20} color={cc.fg} />
                    );
                  })()}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: t.text }]}>{groupName}</Text>
                  <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                    {cats.length} {cats.length === 1 ? "category" : "categories"}
                  </Text>
                </View>
                <Text style={{ color: t.textMuted, fontSize: 22 }}>{isOpen ? "−" : "+"}</Text>
              </Pressable>
              {isOpen ? (
                <View style={[styles.chipWrap, { borderTopColor: t.border }]}>
                  {cats.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => goToTab(nav, "Search")}
                      style={({ pressed }) => [
                        styles.chip,
                        { backgroundColor: cc.bg, borderColor: cc.bg, opacity: pressed ? 0.8 : 1 },
                      ]}
                    >
                      <Text style={[type.small, { color: cc.fg, fontWeight: "700" }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  groupCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  glyph: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
