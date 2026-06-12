import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../components/Screen";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Resp = { groups: Record<string, string[]> };

// Two-level drill-down: top-level groups (Materials, Clothing, Accessories,
// Beauty, ...) then leaf categories under each group. Tapping a leaf
// navigates to Search with the category pre-filled. Phase 3 will switch
// the drill to use Category.parentId so admins can add arbitrary depth.
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
      <Screen padding={false}>
        <View style={styles.centered}><ActivityIndicator color={t.cta} size="large" /></View>
      </Screen>
    );
  }

  const entries = Object.entries(groups);

  return (
    <Screen padding={false}>
      <FlatList
        data={entries}
        keyExtractor={([k]) => k}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListHeaderComponent={
          <Text style={[type.h1, { color: t.text, marginBottom: 8 }]}>All categories</Text>
        }
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={t.cta} onRefresh={() => { setRefreshing(true); load(); }} />}
        renderItem={({ item: [groupName, cats] }) => {
          const isOpen = expanded === groupName;
          return (
            <View>
              <Pressable
                onPress={() => setExpanded(isOpen ? null : groupName)}
                style={[styles.groupRow, { backgroundColor: t.card, borderColor: t.border }]}
              >
                <Text style={[type.bodyStrong, { color: t.text }]}>{groupName}</Text>
                <Text style={{ color: t.textMuted, fontSize: 16 }}>{isOpen ? "−" : "+"}</Text>
              </Pressable>
              {isOpen && (
                <View style={styles.chipWrap}>
                  {cats.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => nav.navigate("Search")}
                      style={[styles.chip, { backgroundColor: t.bgElevated, borderColor: t.border }]}
                    >
                      <Text style={[type.small, { color: t.text, fontWeight: "600" }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  groupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});