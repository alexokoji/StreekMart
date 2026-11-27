import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api } from "../api/client";
import { preorderStatusLabel, preorderTone } from "../lib/preorders";
import { radius, type } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/RootNav";

// Preorders list for the three people involved: the buyer who placed them, the
// seller whose preorder-enabled products they're for, and the designer whose
// designs they're for (GET /api/preorders?role=buyer|seller|designer).
type Row = { id: string; title: string; counterpartyName: string; priceCents: number; status: string; updatedAt: string };

export function PreordersScreen() {
  const t = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { role } = useRoute<RouteProp<RootStackParamList, "Preorders">>().params;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.get<{ preorders: Row[] }>("/api/preorders", { role });
      setRows(d.preorders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const title = role === "buyer" ? "My preorders" : role === "seller" ? "Seller preorders" : "Designer preorders";
  return (
    <ListScaffold<Row>
      title={title}
      data={rows}
      keyExtractor={(r) => r.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => { setRefreshing(true); load(); }}
      emptyIcon="time-outline"
      emptyTitle="No preorders yet"
      emptyMessage={role === "buyer" ? "Pieces you preorder will show here." : "Requests from buyers will show here."}
      renderItem={({ item }) => {
        const tone = t[preorderTone(item.status) === "info" ? "warning" : (preorderTone(item.status) as "success" | "warning" | "danger")];
        const chip = preorderTone(item.status) === "info" ? { fg: t.accent, bg: t.accentSoft } : tone;
        return (
          <Pressable
            onPress={() => nav.navigate("PreorderDetail", { id: item.id, role })}
            style={[styles.row, { backgroundColor: t.card, borderColor: t.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: t.text }]} numberOfLines={2}>{item.title}</Text>
              <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                with {item.counterpartyName} · ₦{Math.round(item.priceCents / 100).toLocaleString("en-NG")}
              </Text>
            </View>
            <View style={[styles.chip, { backgroundColor: chip.bg }]}>
              <Text style={{ color: chip.fg, fontSize: 11, fontWeight: "800" }}>{preorderStatusLabel(item.status)}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
});
