import React, { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ListScaffold } from "../components/ListScaffold";
import { useTheme } from "../state/ThemeContext";
import { api, isNotFound } from "../api/client";
import { radius, type } from "../theme/tokens";

type Commission = {
  id: string;
  status: string;
  brief: string;
  budget: number;
  buyer: { id: string; name: string };
  createdAt: string;
  deadline: string | null;
};

function statusColors(t: ReturnType<typeof useTheme>, status: string) {
  switch (status.toUpperCase()) {
    case "OPEN":
    case "PENDING":
      return { fg: t.warning.fg, bg: t.warning.bg };
    case "ACCEPTED":
    case "IN_PROGRESS":
      return { fg: t.accent, bg: t.accentSoft };
    case "COMPLETED":
      return { fg: t.success.fg, bg: t.success.bg };
    case "DECLINED":
    case "CANCELLED":
      return { fg: t.danger.fg, bg: t.danger.bg };
    default:
      return { fg: t.textMuted, bg: t.border };
  }
}

export function DesignerCommissionsScreen() {
  const t = useTheme();
  const [items, setItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<{ commissions: Commission[] }>("/api/designer/commissions");
      setItems(data.commissions ?? []);
    } catch (err) {
      if (isNotFound(err)) setItems([]);
      else setError(err instanceof Error ? err.message : "Try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function decide(id: string, action: "accept" | "decline") {
    setBusy(id);
    try {
      await api.post(`/api/designer/commissions/${id}/${action}`);
      await load();
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ListScaffold<Commission>
      title="Commissions"
      data={items}
      keyExtractor={(c) => c.id}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      emptyIcon="color-palette-outline"
      emptyTitle="No commission requests"
      emptyMessage="When buyers request a custom piece, it'll show here."
      renderItem={({ item }) => {
        const sc = statusColors(t, item.status);
        const isPending = item.status.toUpperCase() === "OPEN" || item.status.toUpperCase() === "PENDING";
        return (
          <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border, opacity: busy === item.id ? 0.55 : 1 }]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: t.text }]}>From {item.buyer.name}</Text>
                <Text style={[type.small, { color: t.textMuted, marginTop: 2 }]}>
                  {new Date(item.createdAt).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}
                  {item.deadline ? ` · Deadline ${new Date(item.deadline).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}` : ""}
                </Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: sc.bg }]}>
                <Text style={{ color: sc.fg, fontSize: 11, fontWeight: "800" }}>{item.status}</Text>
              </View>
            </View>
            <Text style={[type.body, { color: t.text, marginTop: 10 }]} numberOfLines={4}>
              {item.brief}
            </Text>
            <Text style={[type.bodyStrong, { color: t.cta, marginTop: 8 }]}>
              Budget ₦{Math.round(item.budget).toLocaleString("en-NG")}
            </Text>
            {isPending ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => decide(item.id, "decline")}
                  disabled={busy === item.id}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: t.bg, borderColor: t.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: t.text, fontWeight: "700" }}>Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => decide(item.id, "accept")}
                  disabled={busy === item.id}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: t.cta, borderColor: t.cta, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: t.ctaText, fontWeight: "700" }}>Accept</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
  },
});
